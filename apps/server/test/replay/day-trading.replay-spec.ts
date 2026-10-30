import { type INestApplication, Module } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { env } from '@/config/env.js';
import {
  Bot,
  BotModule,
  BotVersion,
  DAY_TRADING_DEFAULTS,
} from '@/modules/bot/index.js';
import { DecisionModule } from '@/modules/decision/index.js';
import { BotRunnerService } from '@/modules/engine/bot-runner.service.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { FundModule, FundService } from '@/modules/fund/index.js';
import {
  MarketCalendarService,
  MarketCollectorService,
  MarketDataModule,
} from '@/modules/market-data/index.js';
import {
  FeeSchedule,
  OrderModule,
  OrderService,
} from '@/modules/order/index.js';
import { OrderRepository } from '@/modules/order/order.repository.js';
import { PaperBrokerService } from '@/modules/order/paper-broker.service.js';
import { PositionModule } from '@/modules/position/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { createTestApp, resetDatabase } from '../setup/test-app.js';
import {
  loadReplay,
  type ReplayMarket,
  ReplayTossModule,
} from './replay-toss.js';

// 지난 장 하루를 10초 간격으로 다시 돌려 BotRunner·PaperBroker·OrderService를 실제 DB와 함께 점검해요.
//   node --env-file=.env scripts/replay-fetch.mjs 2026-10-30 /tmp/r.json
//   REPLAY_FILE=/tmp/r.json npm run test:replay
const STEP_MS = 10_000;

@Module({
  imports: [
    BotModule,
    DecisionModule,
    EngineStateModule,
    FundModule,
    MarketDataModule,
    OrderModule,
    PositionModule,
    RiskModule,
  ],
  providers: [BotRunnerService],
})
class ReplayModule {}

const file = process.env.REPLAY_FILE;

describe.skipIf(!file)('데이 트레이딩 리플레이', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let market: ReplayMarket;
  const rows = (sql: string) =>
    dataSource.query<Record<string, unknown>[]>(sql);

  beforeAll(async () => {
    market = loadReplay(file ?? '');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(`${market.date}T08:59:00+09:00`));
    env.BROKER_MODE = 'paper';
    app = await createTestApp([ReplayTossModule, ReplayModule]);
    dataSource = app.get(DataSource);
    await resetDatabase(app);

    // scripts/paper-seed.sql과 같은 봇
    await dataSource.getRepository(FeeSchedule).save({
      effectiveFrom: '2026-01-01',
      commissionRate: 0.00015,
      taxRate: 0.002,
    });
    const bot = await dataSource.getRepository(Bot).save({
      name: 'replay-day-trading',
      type: 'day',
      riskProfile: 'neutral',
      stage: 'verifying',
      status: 'running',
      budgetType: 'fixed',
      budgetAmount: 100_000,
      startPriority: 1,
      tradingStart: '09:05:00',
      tradingEnd: '15:20:00',
      periodStart: market.date,
      onPeriodEnd: 'liquidate',
    });
    await dataSource.getRepository(BotVersion).save({
      botId: bot.id,
      version: 1,
      changeKind: 'initial',
      params: {},
      orderSizeType: 'fixed',
      orderSizeValue: 50_000,
      splitCount: 1,
      maxPositions: 2,
      dailyLossPct: 4,
      totalLossPct: 10,
      stopStreak: 3,
      onDailyLimit: 'liquidate',
      appliedAt: new Date(),
    });

    // engine 시작 순서를 줄여서: 캘린더 → 모의 체결 → 시세 연결 → 08:59 투자금 확정.
    // 주기 타이머는 끄고 테스트가 직접 10초씩 돌려요
    await app.get(MarketCalendarService).ensureToday();
    await app.get(OrderService).startBroker();
    app.get(PaperBrokerService).stop();
    const collector = app.get(MarketCollectorService);
    collector.start({
      onOrder: () => undefined,
      onReconnected: () => undefined,
    });
    collector.stop();
    await app.get(FundService).allocate([bot.id]);

    // broker_orders.created_at은 DB 시계(now())라 가짜 시계와 맞지 않아요.
    // 리플레이에서만 주문 수를 판단 시각(decided_at, 앱 시계)으로 세요
    vi.spyOn(
      app.get(OrderRepository),
      'countBotOrdersSince',
    ).mockImplementation(async (since, botId) => {
      const [row] = await dataSource.query<{ n: number }[]>(
        `SELECT count(*)::int AS n FROM broker_orders o
             JOIN decisions d ON d.id = o.decision_id
             JOIN positions p ON p.id = o.position_id
           WHERE o.origin = 'bot' AND d.decided_at >= $1 AND ($2::bigint IS NULL OR p.bot_id = $2)`,
        [since, botId ?? null],
      );
      return row?.n ?? 0;
    });
  }, 300_000);

  afterAll(async () => {
    env.BROKER_MODE = 'toss';
    vi.useRealTimers();
    await app.close();
  });

  it('하루를 돌려도 봇 예외·주문 반복이 없고 장 마감 전에 모두 청산해요', async () => {
    const runner = app.get(BotRunnerService);
    const paper = app.get(PaperBrokerService);
    const start = new Date(`${market.date}T09:00:00+09:00`).getTime();
    const end = new Date(`${market.date}T15:31:00+09:00`).getTime();
    const steps = Array.from(
      { length: (end - start) / STEP_MS },
      (_, index) => start + (index + 1) * STEP_MS,
    );
    await steps.reduce<Promise<void>>(
      (previous, at) =>
        previous.then(async () => {
          vi.setSystemTime(at);
          market.push(at);
          await runner.cycle(new Date(at));
          await paper.match();
        }),
      Promise.resolve(),
    );
    await app.get(OrderService).scoreClosedPositions();

    const summary = {
      decisions: await rows(
        `SELECT kind, skip_reason, count(*)::int AS n FROM decisions GROUP BY 1, 2 ORDER BY 1, 2`,
      ),
      orders: await rows(
        `SELECT side, order_type, status, count(*)::int AS n FROM broker_orders GROUP BY 1, 2, 3 ORDER BY 1, 2, 3`,
      ),
      positions: await rows(
        `SELECT symbol, status, exit_reason, quantity, realized_pnl,
           to_char(opened_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS opened,
           to_char(closed_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI:SS') AS closed
         FROM positions ORDER BY id`,
      ),
      protectives: await rows(
        `SELECT status, count(*)::int AS n FROM protective_orders GROUP BY 1 ORDER BY 1`,
      ),
      riskEvents: await rows(
        `SELECT kind, detail FROM risk_events ORDER BY id`,
      ),
      scores: await rows(
        `SELECT direction_hit, target_reach_pct, error_pct FROM prediction_scores ORDER BY id`,
      ),
      params: DAY_TRADING_DEFAULTS,
    };
    process.stdout.write(
      `\n리플레이 ${market.date}\n${JSON.stringify(summary, null, 2)}\n`,
    );

    // 봇 예외·기록 실패가 없어요
    expect(
      summary.riskEvents.filter(({ kind }) =>
        ['bot_error', 'record_fail'].includes(String(kind)),
      ),
    ).toEqual([]);
    // 포지션마다 진입 매수 주문은 하나예요 (주문 반복 0건)
    await expect(
      rows(
        `SELECT o.position_id FROM broker_orders o JOIN decisions d ON d.id = o.decision_id
         WHERE o.side = 'BUY' AND d.kind = 'enter' GROUP BY 1 HAVING count(*) > 1`,
      ),
    ).resolves.toEqual([]);
    // 데이 트레이딩이라 장 마감 뒤에 남은 보유가 없어요
    expect(
      summary.positions.filter(({ status }) => status !== 'closed'),
    ).toEqual([]);
  }, 600_000);
});
