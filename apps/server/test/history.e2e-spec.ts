import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource, type DeepPartial } from 'typeorm';

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Decision, PredictionScore } from '@/modules/decision/index.js';
import { Allocation } from '@/modules/fund/index.js';
import { QuoteCache } from '@/modules/market-data/index.js';
import { BrokerOrder } from '@/modules/order/index.js';
import { Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

const ENTER_ID = '00000000-0000-4000-8000-000000000001';
const EXIT_ID = '00000000-0000-4000-8000-000000000002';

// 투자 내역 (api.md GET /v1/positions·position-summaries·positions/:id)
describe('투자 내역 (e2e)', () => {
  let app: INestApplication;
  let botId: number;
  let heldId: number;
  let closedId: number;
  let canceledId: number;
  let manualId: number;
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', bearer(app));

  beforeAll(async () => {
    app = await createTestApp();
    const dataSource = app.get(DataSource);
    await resetDatabase(app);
    const bot = await dataSource.getRepository(Bot).save({
      name: 'day',
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      status: 'running' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-11-09',
      onPeriodEnd: 'liquidate' as const,
      startPriority: 1,
    });
    botId = bot.id;
    const version = await dataSource.getRepository(BotVersion).save({
      botId,
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
      appliedAt: new Date('2026-11-09T08:00:00+09:00'),
    });
    const snapshot = await dataSource.getRepository(AccountSnapshot).save({
      takenAt: new Date('2026-11-09T08:59:00+09:00'),
      orderableCash: 210_000,
      runningBotsCashShare: 0,
    });
    await dataSource.getRepository(Allocation).save({
      botId,
      snapshotId: snapshot.id,
      amount: 100_000,
      capped: false,
    });
    const at = (day: string, time: string) =>
      new Date(`2026-11-${day}T${time}:00+09:00`);
    const rows: DeepPartial<Position>[] = [
      {
        botId,
        symbol: '005930',
        status: 'open' as const,
        quantity: 2,
        costBasis: 20_000,
        openedAt: at('09', '09:30'),
      },
      {
        botId,
        symbol: '000660',
        status: 'closed' as const,
        quantity: 0,
        realizedPnl: 900,
        totalFees: 100,
        exitReason: 'take_profit' as const,
        openedAt: at('10', '09:30'),
        closedAt: at('10', '10:00'),
      },
      {
        botId,
        symbol: '035420',
        status: 'closed' as const,
        quantity: 0,
        exitReason: 'not_filled' as const,
        openedAt: at('11', '09:30'),
        closedAt: at('11', '09:40'),
      },
      {
        botId: null,
        symbol: '000660',
        status: 'closed' as const,
        quantity: 0,
        realizedPnl: -500,
        exitReason: 'manual' as const,
        openedAt: at('11', '10:00'),
        closedAt: at('11', '11:00'),
      },
    ];
    const [held, closed, canceled, manual] = await dataSource
      .getRepository(Position)
      .save(rows);
    if (!held || !closed || !canceled || !manual)
      throw new Error('포지션을 만들지 못했어요');
    heldId = held.id;
    closedId = closed.id;
    canceledId = canceled.id;
    manualId = manual.id;
    await dataSource.getRepository(QuoteCache).save({
      symbol: '005930',
      price: 10_500,
      receivedAt: new Date('2026-11-12T01:00:00Z'),
    });
    const decision = {
      botVersionId: version.id,
      positionId: closed.id,
      symbol: '000660',
      failed: [],
      direction: 'up' as const,
      targetPrice: 10_500,
      stopPrice: 9_800,
    };
    await dataSource.getRepository(Decision).save([
      {
        ...decision,
        id: ENTER_ID,
        kind: 'enter' as const,
        decidedAt: at('10', '09:29'),
        price: 10_000,
        passed: [{ rule: 'price_min', value: 10_000, threshold: 5_000 }],
        score: 80,
        horizonMinutes: 60,
      },
      {
        ...decision,
        id: EXIT_ID,
        kind: 'exit' as const,
        decidedAt: at('10', '09:59'),
        price: 10_500,
        passed: [],
      },
    ]);
    await dataSource.getRepository(PredictionScore).save({
      positionId: closed.id,
      decisionId: ENTER_ID,
      directionHit: true,
      targetReachPct: 100,
      errorPct: 0,
      scoredAt: at('10', '15:40'),
    });
    const order = {
      origin: 'bot' as const,
      positionId: closed.id,
      symbol: '000660',
      orderType: 'LIMIT' as const,
      timeInForce: 'DAY' as const,
      quantity: 10,
      status: 'FILLED',
      filledQuantity: 10,
    };
    await dataSource.getRepository(BrokerOrder).save([
      {
        ...order,
        decisionId: ENTER_ID,
        brokerOrderId: 'buy-1',
        side: 'BUY' as const,
        price: 10_000,
        avgFilledPrice: 10_000,
        filledAmount: 100_000,
        commission: 50,
        orderedAt: at('10', '09:30'),
        filledAt: at('10', '09:31'),
      },
      {
        ...order,
        decisionId: EXIT_ID,
        brokerOrderId: 'sell-1',
        side: 'SELL' as const,
        price: 10_100,
        avgFilledPrice: 10_100,
        filledAmount: 101_000,
        commission: 30,
        tax: 20,
        orderedAt: at('10', '09:59'),
        filledAt: at('10', '10:00'),
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/positions', () => {
    it('보유 중을 첫 페이지 맨 위에 두고, 나머지는 최신 진입순이에요', async () => {
      const response = await get('/v1/positions?size=2').expect(200);

      expect(response.body.items.map(({ id }: { id: string }) => id)).toEqual([
        String(heldId),
        String(manualId),
        String(canceledId),
      ]);
      expect(response.body.meta).toMatchObject({ total: 4 });
      expect(response.body.quotedAt).toBe('2026-11-12T01:00:00.000Z');
      expect(response.body.items[0]).toMatchObject({
        status: 'holding',
        botName: 'day',
        botType: 'day',
        quantity: 2,
        avgPrice: 10_000,
        currentPrice: 10_500,
        evaluationAmount: 21_000,
        unrealizedPnl: 1_000,
        unrealizedPnlRate: 5,
        netPnl: 1_000,
      });

      const next = await get('/v1/positions?size=2&page=2').expect(200);
      expect(next.body.items.map(({ id }: { id: string }) => id)).toEqual([
        String(closedId),
      ]);
    });

    it('청산한 줄은 체결로 진입·청산가를 재요', async () => {
      const response = await get(
        `/v1/positions?status=closed&botIds=${botId}`,
      ).expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({
          id: String(closedId),
          status: 'closed',
          quantity: 10,
          entryPrice: 10_000,
          exitPrice: 10_100,
          currentPrice: null,
          netPnl: 900,
          netPnlRate: 0.9,
          exitReason: 'take_profit',
        }),
      ]);
    });

    it('직접 거래·취소·결과로 거를 수 있어요', async () => {
      const manual = await get('/v1/positions?botIds=manual').expect(200);
      expect(manual.body.items).toEqual([
        expect.objectContaining({ id: String(manualId), botId: null }),
      ]);

      const canceled = await get('/v1/positions?status=canceled').expect(200);
      expect(canceled.body.items).toEqual([
        expect.objectContaining({ id: String(canceledId), quantity: 0 }),
      ]);

      const loss = await get('/v1/positions?result=loss').expect(200);
      expect(loss.body.meta).toMatchObject({ total: 1 });
    });

    it('잘못된 상태·봇 id는 400이에요', async () => {
      await get('/v1/positions?status=open').expect(400);
      await get('/v1/positions?botIds=robot').expect(400);
    });
  });

  describe('GET /v1/position-summaries', () => {
    it('봇이 하나가 아니면 필터에 맞는 포지션 전체를 요약해요', async () => {
      const response = await get('/v1/position-summaries').expect(200);

      expect(response.body).toEqual({
        kind: 'overall',
        tradeCount: 3,
        holdingCount: 1,
        closedCount: 2,
        netPnl: 400,
        unrealizedPnl: 1_000,
        cost: 80,
        tax: 20,
        botPnls: expect.arrayContaining([
          { botId: String(botId), name: 'day', pnl: 1_900 },
          { botId: null, name: '직접 거래', pnl: -500 },
        ]),
      });
    });

    it('봇 하나면 그 봇의 자금 요약이에요', async () => {
      const response = await get(
        `/v1/position-summaries?botIds=${botId}`,
      ).expect(200);

      expect(response.body).toMatchObject({
        kind: 'bot',
        budget: 100_000,
        capAmount: 100_000,
        lossLimitPercent: 10,
      });
    });
  });

  describe('GET /v1/positions/:id', () => {
    it('주문, 진입 판단과 조건, 실제 결과, 채점, 판단 흐름을 줘요', async () => {
      const response = await get(`/v1/positions/${closedId}`).expect(200);

      expect(response.body).toMatchObject({
        id: String(closedId),
        position: { id: String(closedId), status: 'closed' },
        botVersion: 1,
        entry: {
          price: 10_000,
          score: 80,
          conditions: [
            {
              label: '주가 하한',
              rule: '기준 5,000원 이상',
              value: '10,000원',
              passed: true,
            },
          ],
          prediction: {
            direction: 'up',
            targetPrice: 10_500,
            targetRate: 5,
            stopRate: -2,
            holdUntil: '10:29까지',
          },
        },
        outcome: { exitPrice: 10_100, holdingMinutes: 30, highPrice: 10_100 },
        scoring: { directionHit: true, actualDirection: 'up' },
      });
      expect(response.body.orders).toEqual([
        expect.objectContaining({
          side: 'BUY',
          kind: 'normal',
          status: 'filled',
          avgPrice: 10_000,
          commission: 50,
        }),
        expect.objectContaining({ side: 'SELL', tax: 20 }),
      ]);
      expect(
        response.body.timeline.map(({ kind }: { kind: string }) => kind),
      ).toEqual(['enter', 'exit']);
    });

    it('직접 거래는 판단 기록이 없어요', async () => {
      const response = await get(`/v1/positions/${manualId}`).expect(200);

      expect(response.body).toMatchObject({
        botVersion: null,
        entry: null,
        scoring: null,
        timeline: [],
      });
    });

    it('없는 포지션은 404 POSITION_NOT_FOUND예요', async () => {
      const response = await get('/v1/positions/999999').expect(404);
      expect(response.body.code).toBe('POSITION_NOT_FOUND');
    });
  });
});
