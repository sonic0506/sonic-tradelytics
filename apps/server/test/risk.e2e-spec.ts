import type { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { Bot } from '@/modules/bot/index.js';
import {
  RiskEvent,
  RiskModule,
  RiskService,
  SymbolLock,
} from '@/modules/risk/index.js';

import { createTestApp, resetDatabase } from './setup/test-app.js';

// 종목 잠금과 한도 정지를 실제 Postgres(부분 unique, 트랜잭션)로 확인해요 (POL-RISK-02, 16)
describe('리스크 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let risk: RiskService;
  let first: number;
  let second: number;

  beforeAll(async () => {
    app = await createTestApp([RiskModule]);
    dataSource = app.get(DataSource);
    risk = app.get(RiskService);
    await resetDatabase(app);
    const bots = await dataSource.getRepository(Bot).save(
      ['scalper', 'day'].map((name, index) => ({
        name,
        type: 'scalping' as const,
        riskProfile: 'neutral' as const,
        status: 'running' as const,
        budgetType: 'fixed' as const,
        budgetAmount: 100_000,
        startPriority: index,
        tradingStart: '09:00',
        tradingEnd: '15:00',
        periodStart: '2026-10-29',
        onPeriodEnd: 'liquidate' as const,
      })),
    );
    [first, second] = bots.map(({ id }) => id) as [number, number];
  });

  afterAll(async () => {
    await app.close();
  });

  it('두 봇이 같은 종목 잠금을 동시에 잡으면 하나만 얻어요', async () => {
    const results = await Promise.all([
      risk.acquireLock('005930', first),
      risk.acquireLock('005930', second),
    ]);

    expect(results.filter(Boolean)).toHaveLength(1);
    await expect(
      dataSource
        .getRepository(SymbolLock)
        .countBy({ symbol: '005930', releasedAt: IsNull() }),
    ).resolves.toBe(1);
  });

  it('잠금을 푼 뒤에는 다른 봇이 잡을 수 있어요', async () => {
    const holder = await dataSource
      .getRepository(SymbolLock)
      .findOneByOrFail({ symbol: '005930', releasedAt: IsNull() });
    const other = holder.botId === first ? second : first;

    await risk.releaseLock('005930', holder.botId);

    await expect(risk.acquireLock('005930', other)).resolves.toBe(true);
  });

  it('하루 손실 한도로 멈춘 봇은 기록이 남고, 다음 거래일 재개로 다시 돌아요', async () => {
    await risk.stopBot(first, 'daily_stop', { dailyPnl: -4000 });

    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: first }),
    ).resolves.toMatchObject({ status: 'paused', statusReason: 'daily_stop' });
    await expect(
      dataSource
        .getRepository(RiskEvent)
        .countBy({ kind: 'daily_stop', botId: first }),
    ).resolves.toBe(1);

    await expect(risk.resumeDailyStops()).resolves.toEqual([first]);
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: first }),
    ).resolves.toMatchObject({ status: 'running', statusReason: null });
  });
});
