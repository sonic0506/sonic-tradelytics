import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { kstAt, kstDate } from '@/common/time/kst-date.js';
import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotVersion } from '@/modules/bot/index.js';
import { EngineStatus } from '@/modules/engine-state/index.js';
import { Allocation } from '@/modules/fund/index.js';
import { MarketCalendar, QuoteCache } from '@/modules/market-data/index.js';
import { BrokerOrder } from '@/modules/order/index.js';
import { BotDailyResult, Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

const DAY_MS = 86_400_000;

// 홈 대시보드 (api.md 홈): 계좌·오늘 손익·봇 카드·오늘 체결을 한 번에 줘요
describe('GET /v1/home (e2e)', () => {
  let app: INestApplication;
  let botId: number;
  const today = kstDate();
  const daysAgo = (days: number) =>
    kstDate(new Date(kstAt(today, '12:00').getTime() - days * DAY_MS));

  beforeAll(async () => {
    app = await createTestApp();
    const dataSource = app.get(DataSource);
    await resetDatabase(app);
    const base = {
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: daysAgo(10),
      onPeriodEnd: 'liquidate' as const,
    };
    const [bot] = await dataSource.getRepository(Bot).save([
      { ...base, name: 'day', startPriority: 1, status: 'running' as const },
      { ...base, name: 'old', startPriority: 2, status: 'stopped' as const },
      { ...base, name: 'new', startPriority: 3, status: 'ready' as const },
    ]);
    if (!bot) throw new Error('봇을 만들지 못했어요');
    botId = bot.id;
    const version = await dataSource.getRepository(BotVersion).save({
      botId,
      version: 2,
      changeKind: 'initial' as const,
      params: {},
      orderSizeType: 'fixed' as const,
      orderSizeValue: 50_000,
      splitCount: 1,
      maxPositions: 2,
      dailyLossPct: 4,
      totalLossPct: 10,
      onDailyLimit: 'liquidate' as const,
      appliedAt: kstAt(daysAgo(10), '08:00'),
    });
    const snapshot = await dataSource.getRepository(AccountSnapshot).save({
      takenAt: kstAt(daysAgo(10), '08:59'),
      orderableCash: 210_000,
      runningBotsCashShare: 0,
    });
    await dataSource.getRepository(Allocation).save({
      botId,
      snapshotId: snapshot.id,
      amount: 100_000,
      capped: false,
    });
    await dataSource.getRepository(MarketCalendar).save(
      [0, 1, 2].map((days) => ({
        tradeDate: daysAgo(days),
        isOpen: true,
        regularOpenAt: null,
        regularCloseAt: null,
        fetchedAt: new Date(),
      })),
    );
    await dataSource.getRepository(BotDailyResult).save(
      [
        [2, 300],
        [1, -200],
      ].map(([days, realizedPnl]) => ({
        botId,
        tradeDate: daysAgo(Number(days)),
        botVersionId: version.id,
        realizedPnl: Number(realizedPnl),
        unrealizedPnl: 0,
        fees: 0,
        closedTrades: 1,
      })),
    );
    const position = (fields: Partial<Position>) => ({
      botId,
      symbol: '005930',
      status: 'closed' as const,
      quantity: 0,
      exitReason: 'rule_exit' as const,
      openedAt: kstAt(today, '09:10'),
      closedAt: kstAt(today, '09:40'),
      ...fields,
    });
    const [closed] = await dataSource.getRepository(Position).save([
      position({ realizedPnl: 500 }),
      position({
        realizedPnl: -100,
        openedAt: kstAt(daysAgo(1), '09:10'),
        closedAt: kstAt(daysAgo(1), '10:00'),
      }),
      position({ realizedPnl: 0, exitReason: 'not_filled' }),
      position({
        status: 'open',
        quantity: 2,
        costBasis: 20_000,
        exitReason: null,
        closedAt: null,
      }),
      position({
        botId: null,
        symbol: '000660',
        status: 'open',
        quantity: 1,
        costBasis: 100_000,
        exitReason: null,
        closedAt: null,
      }),
    ]);
    if (!closed) throw new Error('포지션을 만들지 못했어요');
    await dataSource.getRepository(QuoteCache).save([
      { symbol: '005930', price: 10_500, receivedAt: new Date() },
      { symbol: '000660', price: 99_000, receivedAt: new Date() },
    ]);
    const order = (side: 'BUY' | 'SELL', brokerOrderId: string) => ({
      origin: 'protective' as const,
      positionId: closed.id,
      brokerOrderId,
      symbol: '005930',
      side,
      orderType: 'MARKET' as const,
      timeInForce: 'DAY' as const,
      quantity: 1,
      status: 'FILLED',
      filledQuantity: 1,
      avgFilledPrice: 10_000,
      filledAt: kstAt(today, '09:20'),
    });
    await dataSource
      .getRepository(BrokerOrder)
      .save([order('BUY', 'b-1'), order('SELL', 's-1')]);
    await dataSource.getRepository(EngineStatus).save({
      id: 1,
      state: 'running',
      orderableCash: 3_000_000,
      holdingsValue: 1_000_000,
      accountSyncedAt: new Date(),
      heartbeatAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('계좌·오늘 손익·봇 카드·오늘 체결을 한 번에 줘요', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/home')
      .set('Authorization', bearer(app))
      .expect(200);

    // 봇: 오늘 청산 500 + 보유 2주 평가 1,000. 직접 거래: 평가 -1,000
    expect(response.body).toMatchObject({
      account: {
        evaluationAmount: 4_000_000,
        orderableAmount: 3_000_000,
        holdingSymbolCount: 2,
      },
      todayPnl: { amount: 500, rate: 0.01 },
      botCounts: { running: 1, paused: 0, waitingFunds: 0, stopped: 1 },
      fills: { total: 2, buy: 1, sell: 1 },
    });
    expect(response.body.bots).toEqual([
      {
        id: String(botId),
        name: 'day',
        type: 'day',
        status: 'running',
        stage: 'verifying',
        version: 2,
        todayPnl: 1_500,
        todayFills: 2,
        // 청산 2건(500, -100) 중 1건 이김. not_filled는 빼요
        winRate30d: 0.5,
        budget: 100_000,
        budgetSetting: { type: 'fixed', value: 100_000 },
        last7Days: [300, -200],
      },
      expect.objectContaining({
        name: 'new',
        version: 0,
        budget: null,
        winRate30d: null,
        last7Days: [],
      }),
    ]);
  });
});
