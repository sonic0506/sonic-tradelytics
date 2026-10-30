import { randomUUID } from 'node:crypto';

import { DataSource } from 'typeorm';

import { env } from '@/config/env.js';

// 코드가 아니라 DB가 지키는 규칙(docs/architecture/data-model.md)을 실제 Postgres로 확인해요.
describe('DB 스키마 규칙', () => {
  let db: DataSource;

  beforeAll(async () => {
    db = await new DataSource({
      type: 'postgres',
      url: env.DATABASE_URL,
    }).initialize();
  });
  afterAll(async () => {
    await db.destroy();
  });

  // RETURNING 한 행을 꺼내요
  const queryOne = async <T>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T> => {
    const [row] = (await db.query(sql, params)) as T[];
    if (!row) throw new Error('결과 행이 없어요');
    return row;
  };

  const insertBot = async (): Promise<number> => {
    const { id } = await queryOne<{ id: number }>(
      `INSERT INTO bots (name, type, risk_profile, budget_type, budget_ratio, start_priority, trading_start, trading_end, period_start, on_period_end)
       VALUES ($1, 'day', 'neutral', 'ratio', 0.3, 1, '09:05', '15:15', '2026-10-28', 'liquidate') RETURNING id`,
      [`봇-${randomUUID()}`],
    );
    return id;
  };

  const insertBotVersion = async (botId: number): Promise<number> => {
    const { id } = await queryOne<{ id: number }>(
      `INSERT INTO bot_versions (bot_id, version, change_kind, params, order_size_type, order_size_value, split_count, max_positions, daily_loss_pct, total_loss_pct, on_daily_limit)
       VALUES ($1, 1, 'initial', '{}', 'ratio', 0.5, 1, 1, 4, 10, 'hold') RETURNING id`,
      [botId],
    );
    return id;
  };

  const insertPosition = async (botId: number): Promise<number> => {
    const { id } = await queryOne<{ id: number }>(
      `INSERT INTO positions (bot_id, symbol, status, quantity, opened_at)
       VALUES ($1, '005930', 'open', 0, now()) RETURNING id`,
      [botId],
    );
    return id;
  };

  const insertSkipDecision = async (botVersionId: number): Promise<string> => {
    const id = randomUUID();
    await db.query(
      `INSERT INTO decisions (id, bot_version_id, symbol, kind, decided_at, price, passed, failed, skip_reason)
       VALUES ($1, $2, '005930', 'skip', now(), 230000, '[]', '[]', 'entry_condition')`,
      [id, botVersionId],
    );
    return id;
  };

  it('추가만 하는 표는 UPDATE·DELETE를 거부해요', async () => {
    const botVersionId = await insertBotVersion(await insertBot());
    const decisionId = await insertSkipDecision(botVersionId);

    await expect(
      db.query(`UPDATE decisions SET price = 1 WHERE id = $1`, [decisionId]),
    ).rejects.toMatchObject({ code: '23001' });
    await expect(
      db.query(`DELETE FROM decisions WHERE id = $1`, [decisionId]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('리스크 이벤트는 notified_at을 한 번 채우는 것만 허용해요', async () => {
    const { id } = await queryOne<{ id: number }>(
      `INSERT INTO risk_events (kind, occurred_at, detail) VALUES ('feed_stale', now(), '{}') RETURNING id`,
    );
    const notify = `UPDATE risk_events SET notified_at = now() WHERE id = $1`;

    await db.query(notify, [id]);
    await expect(db.query(notify, [id])).rejects.toMatchObject({
      code: '23001',
    });
    await expect(
      db.query(`UPDATE risk_events SET kind = 'bot_error' WHERE id = $1`, [id]),
    ).rejects.toMatchObject({ code: '23001' });
  });

  it('한 종목의 잠금은 하나만 살아 있고, 풀면 다시 잡을 수 있어요', async () => {
    const botId = await insertBot();
    const symbol = randomUUID().slice(0, 6);
    const lock = `INSERT INTO symbol_locks (symbol, bot_id, acquired_at) VALUES ($1, $2, now()) RETURNING id`;
    const { id } = await queryOne<{ id: number }>(lock, [symbol, botId]);

    await expect(db.query(lock, [symbol, botId])).rejects.toMatchObject({
      code: '23505',
    });
    await db.query(
      `UPDATE symbol_locks SET released_at = now() WHERE id = $1`,
      [id],
    );
    await expect(db.query(lock, [symbol, botId])).resolves.toHaveLength(1);
  });

  it('포지션당 살아 있는 손절 조건주문은 하나예요', async () => {
    const positionId = await insertPosition(await insertBot());
    const protect = `INSERT INTO protective_orders (position_id, client_order_id, trigger_price, quantity, expire_date, status)
       VALUES ($1, $2, 220000, 1, '2026-10-28', $3)`;

    await db.query(protect, [positionId, randomUUID(), 'canceled']);
    await db.query(protect, [positionId, randomUUID(), 'open']);
    await expect(
      db.query(protect, [positionId, randomUUID(), 'requested']),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('봇 주문은 판단이 있어야 하고, 접수 실패는 거부 코드가 있어야 해요', async () => {
    const positionId = await insertPosition(await insertBot());
    const order = `INSERT INTO broker_orders (origin, decision_id, position_id, symbol, side, order_type, time_in_force, quantity, status, reject_code)
       VALUES ($1, NULL, $2, '005930', 'BUY', 'MARKET', 'DAY', 1, $3, $4)`;

    await expect(
      db.query(order, ['bot', positionId, 'requested', null]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(order, ['manual', positionId, 'request_failed', null]),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      db.query(order, ['manual', positionId, 'request_failed', 'not_found']),
    ).resolves.toBeDefined();
  });

  it('운용 자산은 DB가 주문 가능 금액에서 봇 현금 몫을 빼서 계산해요', async () => {
    const row = await queryOne<{ available_capital: string }>(
      `INSERT INTO account_snapshots (taken_at, orderable_cash, running_bots_cash_share)
       VALUES (now(), 1000000, 300000) RETURNING available_capital`,
    );

    expect(Number(row.available_capital)).toBe(700000);
  });
});
