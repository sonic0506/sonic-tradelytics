import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Decision, PredictionScore } from '@/modules/decision/index.js';
import { Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 정확도 분석 (api.md GET /v1/accuracy-stats)
describe('GET /v1/accuracy-stats (e2e)', () => {
  let app: INestApplication;
  let botId: number;
  const get = (query = '') =>
    request(app.getHttpServer())
      .get(`/v1/accuracy-stats${query}`)
      .set('Authorization', bearer(app));

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
    const closed = (
      realizedPnl: number,
      exitReason: Position['exitReason'],
    ) => ({
      botId,
      symbol: '005930',
      status: 'closed' as const,
      quantity: 0,
      realizedPnl,
      exitReason,
      openedAt: new Date('2026-11-10T09:30:00+09:00'),
      closedAt: new Date('2026-11-10T10:00:00+09:00'),
    });
    const [win, loss, canceled] = await dataSource
      .getRepository(Position)
      .save([
        closed(500, 'take_profit'),
        closed(-300, 'stop_loss'),
        closed(0, 'not_filled'),
      ]);
    if (!win || !loss || !canceled) throw new Error('포지션을 만들지 못했어요');
    const ids = [1, 2, 3].map((n) => `00000000-0000-4000-8000-00000000000${n}`);
    const entry = (id: string, positionId: number, score: number) => ({
      id,
      botVersionId: version.id,
      positionId,
      symbol: '005930',
      kind: 'enter' as const,
      decidedAt: new Date('2026-11-10T09:29:00+09:00'),
      price: 10_000,
      passed: [],
      failed: [],
      score,
      direction: 'up' as const,
      targetPrice: 10_500,
      stopPrice: 9_800,
    });
    await dataSource
      .getRepository(Decision)
      .save([
        entry(ids[0] ?? '', win.id, 92),
        entry(ids[1] ?? '', loss.id, 75),
        entry(ids[2] ?? '', canceled.id, 95),
      ]);
    const score = (decisionId: string, positionId: number, isHit: boolean) => ({
      positionId,
      decisionId,
      directionHit: isHit,
      targetReachPct: isHit ? 100 : 0,
      errorPct: isHit ? 0 : -8,
      scoredAt: new Date('2026-11-10T15:40:00+09:00'),
    });
    await dataSource
      .getRepository(PredictionScore)
      .save([
        score(ids[0] ?? '', win.id, true),
        score(ids[1] ?? '', loss.id, false),
      ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('봇별 채점 요약과 신뢰 점수 구간별 승률을 줘요. 체결 없이 닫힌 진입은 구간에서 빼요', async () => {
    const response = await get().expect(200);

    expect(response.body).toEqual({
      summary: {
        scoredCount: 2,
        directionHitRate: 0.5,
        targetReachRate: 0.5,
        bots: [
          {
            botId: String(botId),
            name: 'day',
            scoredCount: 2,
            directionHitRate: 0.5,
            targetReachRate: 0.5,
            avgErrorPct: -4,
          },
        ],
      },
      scoreBuckets: [
        { min: 90, max: 100, closedCount: 1, winRate: 1 },
        { min: 80, max: 89, closedCount: 0, winRate: 0 },
        { min: 70, max: 79, closedCount: 1, winRate: 0 },
        { min: 60, max: 69, closedCount: 0, winRate: 0 },
        { min: 0, max: 59, closedCount: 0, winRate: 0 },
      ],
    });
  });

  it('기간 밖이거나 다른 봇이면 비어요', async () => {
    const later = await get('?from=2026-11-11').expect(200);
    expect(later.body.summary).toMatchObject({ scoredCount: 0, bots: [] });

    const other = await get('?botIds=999999').expect(200);
    expect(other.body.scoreBuckets[0]).toMatchObject({ closedCount: 0 });
  });

  it('봇 id 형식이 틀리면 400이에요', async () => {
    await get('?botIds=day').expect(400);
  });
});
