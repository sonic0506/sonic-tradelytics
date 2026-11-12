import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';
import { BotDailyResult } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 장후 배치가 남긴 bot_daily_results를 일별 손익 화면용으로 읽어요 (api.md 홈·실적)
describe('일별 손익 (e2e)', () => {
  let app: INestApplication;
  let verifyingId: number;
  let releasedId: number;
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', bearer(app));

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
    const [verifying, released] = await dataSource.getRepository(Bot).save([
      { ...base, name: 'verifying', startPriority: 1 },
      {
        ...base,
        name: 'released',
        startPriority: 2,
        stage: 'released' as const,
      },
    ]);
    if (!verifying || !released) throw new Error('봇을 만들지 못했어요');
    verifyingId = verifying.id;
    releasedId = released.id;
    const versions = await dataSource.getRepository(BotVersion).save(
      [verifying, released].map(({ id }) => ({
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
        appliedAt: new Date('2026-11-09T08:00:00+09:00'),
      })),
    );
    const row = (
      botId: number,
      tradeDate: string,
      fields: Pick<
        BotDailyResult,
        'realizedPnl' | 'unrealizedPnl' | 'fees' | 'closedTrades'
      >,
    ) => ({
      botId,
      tradeDate,
      botVersionId: versions.find((version) => version.botId === botId)?.id,
      ...fields,
    });
    await dataSource.getRepository(BotDailyResult).save([
      row(verifyingId, '2026-11-09', {
        realizedPnl: -1_000,
        unrealizedPnl: 200,
        fees: 300,
        closedTrades: 3,
      }),
      row(releasedId, '2026-11-09', {
        realizedPnl: 500,
        unrealizedPnl: 0,
        fees: 100,
        closedTrades: 1,
      }),
      row(verifyingId, '2026-11-10', {
        realizedPnl: -4_248,
        unrealizedPnl: 0,
        fees: 1_068,
        closedTrades: 11,
      }),
      row(verifyingId, '2026-11-11', {
        realizedPnl: 1_621,
        unrealizedPnl: 0,
        fees: 329,
        closedTrades: 4,
      }),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('봇 전체 일별 손익은 기간 안의 날짜마다 봇들을 더해 날짜순으로 줘요', async () => {
    const response = await get(
      '/v1/daily-results?from=2026-11-09&to=2026-11-10',
    ).expect(200);

    expect(response.body).toEqual({
      items: [
        { tradeDate: '2026-11-09', pnl: -300, fees: 400, closedTrades: 4 },
        { tradeDate: '2026-11-10', pnl: -4_248, fees: 1_068, closedTrades: 11 },
      ],
    });
  });

  it('봇 전체 일별 손익은 기간이 없거나 날짜 형식이 틀리면 400이에요', async () => {
    await get('/v1/daily-results?from=2026-11-09').expect(400);
    await get('/v1/daily-results?from=11/09&to=2026-11-10').expect(400);
  });

  it('봇 하나의 일별 손익은 from 이후를 날짜순으로, 그날 검증 구간이었는지와 함께 줘요', async () => {
    const response = await get(
      `/v1/bots/${verifyingId}/daily-results?from=2026-11-10`,
    ).expect(200);

    expect(response.body).toEqual({
      items: [
        { tradeDate: '2026-11-10', pnl: -4_248, verifying: true },
        { tradeDate: '2026-11-11', pnl: 1_621, verifying: true },
      ],
    });
  });

  it('상한이 풀린 봇의 날은 검증 구간이 아니에요', async () => {
    const response = await get(`/v1/bots/${releasedId}/daily-results`).expect(
      200,
    );

    expect(response.body.items).toEqual([
      { tradeDate: '2026-11-09', pnl: 500, verifying: false },
    ]);
  });

  it('없는 봇이면 404예요', async () => {
    const response = await get('/v1/bots/9999/daily-results').expect(404);

    expect(response.body.code).toBe('BOT_NOT_FOUND');
  });
});
