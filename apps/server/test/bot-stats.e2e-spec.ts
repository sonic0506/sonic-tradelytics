import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Allocation } from '@/modules/fund/index.js';
import { BotDailyResult, Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 봇 비교 표 (api.md 실적): 청산 포지션과 장후 일일 집계, 확정 투자금을 읽어 지표를 계산해요
describe('GET /v1/bot-stats (e2e)', () => {
  let app: INestApplication;
  let botId: number;
  let idleId: number;
  const get = (query = '') =>
    request(app.getHttpServer())
      .get(`/v1/bot-stats${query}`)
      .set('Authorization', bearer(app));

  beforeAll(async () => {
    app = await createTestApp();
    const dataSource = app.get(DataSource);
    await resetDatabase(app);
    const base = {
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      status: 'running' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-11-09',
      onPeriodEnd: 'liquidate' as const,
    };
    const [bot, idle] = await dataSource.getRepository(Bot).save([
      { ...base, name: 'day', startPriority: 1 },
      { ...base, name: 'idle', startPriority: 2, status: 'ready' as const },
    ]);
    if (!bot || !idle) throw new Error('봇을 만들지 못했어요');
    botId = bot.id;
    idleId = idle.id;
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
    const closed = (
      owner: number | null,
      day: string,
      realizedPnl: number,
      totalFees: number,
      exitReason: Position['exitReason'] = 'rule_exit',
    ) => ({
      botId: owner,
      symbol: '005930',
      status: 'closed' as const,
      quantity: 0,
      realizedPnl,
      totalFees,
      exitReason,
      openedAt: new Date(`${day}T10:00:00+09:00`),
      closedAt: new Date(`${day}T10:30:00+09:00`),
    });
    await dataSource
      .getRepository(Position)
      .save([
        closed(botId, '2026-11-10', 600, 50),
        closed(botId, '2026-11-10', -200, 50),
        closed(botId, '2026-11-10', -100, 50),
        closed(botId, '2026-11-10', 0, 0, 'not_filled'),
        closed(botId, '2026-11-11', 300, 50),
        closed(null, '2026-11-10', -1_000, 80),
      ]);
    await dataSource.getRepository(BotDailyResult).save(
      [
        ['2026-11-10', 300],
        ['2026-11-11', -2_000],
        ['2026-11-12', 500],
      ].map(([tradeDate, realizedPnl]) => ({
        botId,
        tradeDate: String(tradeDate),
        botVersionId: version.id,
        realizedPnl: Number(realizedPnl),
        unrealizedPnl: 0,
        fees: 0,
        closedTrades: 0,
      })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('봇마다 기간 지표를 주고, 직접 거래 한 줄을 끝에 붙여요', async () => {
    const response = await get('?from=2026-11-10&to=2026-11-10').expect(200);

    expect(response.body).toEqual({
      items: [
        {
          botId: String(botId),
          name: 'day',
          stage: 'verifying',
          returnRate: 0.3,
          netPnl: 300,
          winRate: 0.33,
          profitFactor: 4,
          mdd: 0,
          avgHoldMinutes: 30,
          tradeCount: 3,
          cost: 150,
        },
        {
          botId: String(idleId),
          name: 'idle',
          stage: 'verifying',
          returnRate: null,
          netPnl: null,
          winRate: null,
          profitFactor: null,
          mdd: null,
          avgHoldMinutes: null,
          tradeCount: 0,
          cost: 0,
        },
        {
          botId: null,
          name: '직접 거래',
          stage: null,
          returnRate: null,
          netPnl: -1_000,
          winRate: 0,
          profitFactor: null,
          mdd: null,
          avgHoldMinutes: 30,
          tradeCount: 1,
          cost: 80,
        },
      ],
      benchmark: null,
    });
  });

  it('기간이 없으면 전체 기록으로 MDD를 일별 누적 곡선에서 재요', async () => {
    const response = await get().expect(200);

    // 일별 누적 300 → -1,700 → -1,200: 고점 300에서 2,000 하락 = 2%
    expect(response.body.items[0]).toMatchObject({
      netPnl: 600,
      tradeCount: 4,
      mdd: 2,
      returnRate: 0.6,
    });
  });

  it('날짜 형식이 틀리면 400이에요', async () => {
    await get('?from=2026/11/10').expect(400);
  });
});
