import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Decision, PredictionScore } from '@/modules/decision/index.js';
import {
  BrokerOrder,
  type EntryRequest,
  OrderModule,
  OrderService,
} from '@/modules/order/index.js';
import { Position } from '@/modules/position/index.js';
import { SymbolLock } from '@/modules/risk/index.js';

import { FakeTossModule } from './setup/fake-toss.js';
import { createTestApp, resetDatabase } from './setup/test-app.js';

// 진입 주문 저장을 실제 Postgres 제약(판단 예측 필수, 봇 주문의 decision_id, FK)과 트랜잭션으로 확인해요 (ADR-0003)
describe('진입 주문 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orders: OrderService;
  const bots: { botId: number; botVersionId: number }[] = [];

  const request = (index: number): EntryRequest => {
    const bot = bots[index];
    if (!bot) throw new Error('봇이 없어요');
    return {
      ...bot,
      symbol: '005930',
      price: 70_000,
      quantity: 3,
      rationale: {
        passed: [{ rule: 'volume_ratio', value: 2.1, threshold: 1.5 }],
        failed: [],
        score: 80,
        direction: 'up',
        targetPrice: 73_000,
        stopPrice: 68_000,
        horizonMinutes: 60,
      },
    };
  };

  beforeAll(async () => {
    app = await createTestApp([FakeTossModule, OrderModule]);
    dataSource = app.get(DataSource);
    orders = app.get(OrderService);
    await resetDatabase(app);
    const saved = await dataSource.getRepository(Bot).save(
      ['first', 'second'].map((name, index) => ({
        name,
        type: 'day_trading' as const,
        riskProfile: 'neutral' as const,
        status: 'running' as const,
        budgetType: 'fixed' as const,
        budgetAmount: 1_000_000,
        startPriority: index,
        tradingStart: '09:00',
        tradingEnd: '15:00',
        periodStart: '2026-10-29',
        onPeriodEnd: 'liquidate' as const,
      })),
    );
    const versions = await dataSource.getRepository(BotVersion).save(
      saved.map(({ id }) => ({
        botId: id,
        version: 1,
        changeKind: 'initial' as const,
        params: {},
        orderSizeType: 'ratio' as const,
        orderSizeValue: 0.2,
        splitCount: 1,
        maxPositions: 3,
        dailyLossPct: 4,
        totalLossPct: 10,
        onDailyLimit: 'liquidate' as const,
        appliedAt: new Date(),
      })),
    );
    bots.push(
      ...versions.map(({ id, botId }) => ({ botId, botVersionId: id })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('진입하면 포지션·판단·주문·종목 잠금이 함께 남고 판단 id로 주문해요', async () => {
    const result = await orders.enter(request(0));

    const order = await dataSource
      .getRepository(BrokerOrder)
      .findOneByOrFail({ symbol: '005930' });
    expect(result).toEqual({
      status: 'accepted',
      brokerOrderId: `fake-${order.decisionId ?? ''}`,
    });
    expect(order).toMatchObject({
      origin: 'bot',
      status: 'PENDING',
      side: 'BUY',
      quantity: 3,
    });
    await expect(
      dataSource
        .getRepository(Decision)
        .findOneByOrFail({ id: order.decisionId ?? '' }),
    ).resolves.toMatchObject({
      kind: 'enter',
      positionId: order.positionId,
      direction: 'up',
    });
    await expect(
      dataSource
        .getRepository(Position)
        .findOneByOrFail({ id: order.positionId }),
    ).resolves.toMatchObject({
      botId: bots[0]?.botId,
      status: 'open',
      quantity: 0,
    });
    await expect(
      dataSource
        .getRepository(SymbolLock)
        .findOneByOrFail({ symbol: '005930', releasedAt: IsNull() }),
    ).resolves.toMatchObject({ botId: bots[0]?.botId });
  });

  it('다른 봇이 잠근 종목이면 주문 없이 건너뛴 판단만 남아요', async () => {
    await expect(orders.enter(request(1))).resolves.toEqual({
      status: 'skipped',
      reason: 'symbol_lock',
    });

    await expect(dataSource.getRepository(BrokerOrder).count()).resolves.toBe(
      1,
    );
    await expect(
      dataSource
        .getRepository(Decision)
        .countBy({ kind: 'skip', skipReason: 'symbol_lock' }),
    ).resolves.toBe(1);
  });

  it('장후 채점은 닫힌 포지션의 진입 판단을 평균 매도가로 한 번만 채점해요', async () => {
    const buy = await dataSource
      .getRepository(BrokerOrder)
      .findOneByOrFail({ symbol: '005930', side: 'BUY' });
    const entry = await dataSource
      .getRepository(Decision)
      .findOneByOrFail({ id: buy.decisionId ?? '' });
    // 청산 판단과 그 매도 주문 (주문 1개 = 판단 1개)
    const exitId = randomUUID();
    await dataSource
      .getRepository(Decision)
      .save({ ...entry, id: exitId, kind: 'exit' });
    await dataSource.getRepository(BrokerOrder).save({
      ...buy,
      id: undefined,
      decisionId: exitId,
      brokerOrderId: 'sell-1',
      side: 'SELL',
      status: 'FILLED',
      filledQuantity: 3,
      filledAmount: 216_000,
    });
    await dataSource
      .getRepository(Position)
      .update(
        { id: buy.positionId },
        { status: 'closed', quantity: 0, closedAt: new Date() },
      );

    await expect(orders.scoreClosedPositions()).resolves.toBe(1);
    await expect(orders.scoreClosedPositions()).resolves.toBe(0);

    // 평균 매도가 72,000: 상승 적중, 목표(73,000)까지 2/3, 목표보다 진입가의 1.429% 낮음
    await expect(
      dataSource.getRepository(PredictionScore).find({ take: 2 }),
    ).resolves.toEqual([
      expect.objectContaining({
        positionId: buy.positionId,
        decisionId: buy.decisionId,
        directionHit: true,
        targetReachPct: 66.67,
        errorPct: -1.429,
      }),
    ]);
  });
});
