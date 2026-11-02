import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Allocation } from '@/modules/fund/index.js';
import { MarketCalendar, QuoteCache } from '@/modules/market-data/index.js';
import { Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 봇 목록·상세 (api.md 봇): engine이 쓴 배분·포지션·최근가·장 일정을 읽어 계산해요.
// 오늘 운영 상황이 시각에 따라 달라서 시계(Date)만 2026-10-30(금) 11:00 KST로 고정해요
describe('봇 목록·상세 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let runningId: number;
  let readyId: number;
  const now = new Date('2026-10-30T11:00:00+09:00');
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', bearer(app));

  beforeAll(async () => {
    vi.useFakeTimers({ now, toFake: ['Date'] });
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(app);
    const base = {
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      onPeriodEnd: 'liquidate' as const,
    };
    const [running, ready] = await dataSource.getRepository(Bot).save([
      {
        ...base,
        name: 'running',
        status: 'running' as const,
        startPriority: 1,
        periodStart: '2026-10-29',
      },
      {
        ...base,
        name: 'ready',
        status: 'ready' as const,
        startPriority: 2,
        periodStart: '2026-11-05',
      },
    ]);
    if (!running || !ready) throw new Error('봇을 만들지 못했어요');
    runningId = running.id;
    readyId = ready.id;
    await dataSource.getRepository(BotVersion).save(
      [running, ready].map(({ id }) => ({
        botId: id,
        version: 1,
        changeKind: 'initial' as const,
        params: {},
        orderSizeType: 'fixed' as const,
        orderSizeValue: 50_000,
        splitCount: 1,
        maxPositions: 2,
        dailyLossPct: 4,
        totalLossPct: 10,
        onDailyLimit: 'liquidate' as const,
        appliedAt: now,
      })),
    );
    const snapshot = await dataSource.getRepository(AccountSnapshot).save({
      takenAt: now,
      orderableCash: 210_000,
      runningBotsCashShare: 0,
    });
    await dataSource.getRepository(Allocation).save({
      botId: runningId,
      snapshotId: snapshot.id,
      amount: 100_000,
      capped: false,
    });
    // 70,000원에 1주 보유, 최근가 71,000원 → 평가 +1,000원
    await dataSource.getRepository(Position).save({
      botId: runningId,
      symbol: '005930',
      status: 'open' as const,
      quantity: 1,
      costBasis: 70_000,
      openedAt: now,
    });
    await dataSource
      .getRepository(QuoteCache)
      .save({ symbol: '005930', price: 71_000, receivedAt: now });
    await dataSource.getRepository(MarketCalendar).save(
      ['2026-10-30', '2026-11-02'].map((tradeDate) => ({
        tradeDate,
        isOpen: true,
        regularOpenAt: new Date(`${tradeDate}T09:00:00+09:00`),
        regularCloseAt: new Date(`${tradeDate}T15:30:00+09:00`),
        fetchedAt: now,
      })),
    );
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it('목록은 확정 투자금·오늘 손익·오늘 운영 상황·다음 운영 시각을 줘요', async () => {
    const response = await get('/v1/bots').expect(200);

    expect(response.body.meta).toMatchObject({ total: 2 });
    const [running, ready] = response.body.items;
    expect(running).toMatchObject({
      id: String(runningId),
      name: 'running',
      type: 'day',
      version: 1,
      status: 'running',
      statusReason: null,
      stage: 'verifying',
      capAmount: 100_000,
      budget: 100_000,
      budgetSetting: { type: 'fixed', value: 100_000 },
      todayPnl: 1_000,
      todayPnlRate: 1,
      activity: 'trading',
      resting: false,
      nextRunAt: new Date('2026-11-02T09:05:00+09:00').toISOString(),
      tradingHours: { start: '09:05', end: '15:20' },
    });
    // 시작 전 봇은 확정 투자금·운영 상황이 없고, 다음 운영은 운용 시작일이에요
    expect(ready).toMatchObject({
      id: String(readyId),
      status: 'ready',
      budget: null,
      activity: null,
      resting: false,
      nextRunAt: new Date('2026-11-05T09:05:00+09:00').toISOString(),
    });
  });

  it('상세는 자금·손실 여유·규칙 값·쉬는 중이 아닌 이유·보유 종목을 줘요', async () => {
    const response = await get(`/v1/bots/${runningId}`).expect(200);

    expect(response.body).toMatchObject({
      cumulativePnl: 1_000,
      cumulativePnlRate: 1,
      // 누적 한도 -10% = 10,000원에 지금 +1,000원
      lossStop: { remaining: 11_000, limitPercent: 10 },
      funds: {
        capitalAtAllocation: 210_000,
        usedAmount: 70_000,
        remainingBudget: 30_000,
        cashShare: 30_000,
        realizedPnl: 0,
        startPriority: 1,
        pendingReason: null,
      },
      releaseCriteria: [],
      pendingVersion: null,
      notRestingReasons: ['holding', 'trading_hours'],
      settings: {
        periodEnd: null,
        onPeriodEnd: 'liquidate',
        startPriority: 1,
        orderAmount: 50_000,
      },
      holdings: [{ symbolName: '005930', quantity: 1 }],
    });
    expect(response.body.ruleVersion).toMatchObject({ version: 1 });
    expect(response.body.ruleVersion.values).toContainEqual({
      label: '거래대금 순위',
      display: '30위',
    });
    expect(response.body.ruleVersion.fields).toContainEqual(
      expect.objectContaining({ key: 'exitAt', value: '15:15' }),
    );
  });

  it('없는 봇은 404이고, /v1/bots/options는 id로 해석되지 않아요', async () => {
    const missing = await get('/v1/bots/999').expect(404);
    expect(missing.body).toMatchObject({ code: 'BOT_NOT_FOUND' });

    const options = await get('/v1/bots/options').expect(200);
    expect(options.body).toHaveLength(2);
  });
});
