import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';
import { Position } from '@/modules/position/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 규칙 값 버전 (api.md 규칙 값 버전, FR-BOT-03, 11, POL-RISK-13)
describe('봇 규칙 값 버전 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', bearer(app))
      .send(body);
  const get = (path: string) =>
    request(app.getHttpServer()).get(path).set('Authorization', bearer(app));

  // 장 일정이 없어 운영 시간 밖으로 봐요. 보유 종목이 없으면 쉬는 중이에요
  const createBot = async (
    name: string,
    stage: Bot['stage'] = 'verifying',
  ): Promise<number> => {
    const bot = await dataSource.getRepository(Bot).save({
      name,
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      status: 'running' as const,
      stage,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-11-09',
      onPeriodEnd: 'liquidate' as const,
      startPriority: 1,
    });
    await dataSource.getRepository(BotVersion).save({
      botId: bot.id,
      version: 1,
      changeKind: 'initial' as const,
      params: { maxRank: 30 },
      orderSizeType: 'fixed' as const,
      orderSizeValue: 50_000,
      splitCount: 1,
      maxPositions: 2,
      dailyLossPct: 4,
      totalLossPct: 10,
      onDailyLimit: 'liquidate' as const,
      appliedAt: new Date('2026-11-09T08:00:00+09:00'),
    });
    return bot.id;
  };

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('손실 한도만 낮추면 risk_only, 진입 값을 바꾸거나 한도를 높이면 decision_change예요', async () => {
    const botId = await createBot('preview');

    const riskOnly = await post(`/v1/bots/${botId}/version-previews`, {
      params: {},
      lossStop: { first: 3, total: 10 },
    }).expect(200);
    expect(riskOnly.body).toEqual({
      changeKind: 'risk_only',
      applyTiming: 'now',
      reconfirmsAtCap: false,
      changes: [{ label: '하루 손실 한도', from: '4%', to: '3%' }],
    });

    const raise = await post(`/v1/bots/${botId}/version-previews`, {
      params: {},
      lossStop: { first: 5, total: 10 },
    }).expect(200);
    expect(raise.body.changeKind).toBe('decision_change');

    const entry = await post(`/v1/bots/${botId}/version-previews`, {
      params: { maxRank: 20 },
    }).expect(200);
    expect(entry.body).toMatchObject({
      changeKind: 'decision_change',
      changes: [{ label: '거래대금 순위', from: '30위', to: '20위' }],
    });

    const same = await post(`/v1/bots/${botId}/version-previews`, {
      params: {},
    }).expect(200);
    expect(same.body).toMatchObject({ changeKind: null, changes: [] });
  });

  it('쉬는 중인 봇은 저장하면 바로 적용되고, 상한이 풀린 봇의 판단 변경은 검증 구간으로 돌아가요', async () => {
    const botId = await createBot('resting', 'released');

    const preview = await post(`/v1/bots/${botId}/version-previews`, {
      params: { maxRank: 20 },
    }).expect(200);
    expect(preview.body).toMatchObject({
      applyTiming: 'now',
      reconfirmsAtCap: true,
    });

    const saved = await post(`/v1/bots/${botId}/versions`, {
      params: { maxRank: 20 },
    }).expect(201);
    expect(saved.body).toMatchObject({
      version: 2,
      changeKind: 'decision_change',
      appliedAt: expect.any(String),
    });
    await expect(
      dataSource.getRepository(Bot).findOneByOrFail({ id: botId }),
    ).resolves.toMatchObject({ stage: 'verifying' });

    const list = await get(`/v1/bots/${botId}/versions`).expect(200);
    expect(list.body.items).toEqual([
      expect.objectContaining({
        version: 2,
        changeKind: 'decision_change',
        changes: [{ label: '거래대금 순위', from: '30위', to: '20위' }],
      }),
      expect.objectContaining({
        version: 1,
        changeKind: 'initial',
        changes: [],
      }),
    ]);
  });

  it('보유 종목이 있으면 적용 대기로 저장하고, 대기 중에는 새 버전을 더 넣지 않아요', async () => {
    const botId = await createBot('holding');
    await dataSource.getRepository(Position).save({
      botId,
      symbol: '005930',
      status: 'open' as const,
      quantity: 1,
      costBasis: 10_000,
      openedAt: new Date(),
    });

    const preview = await post(`/v1/bots/${botId}/version-previews`, {
      params: { maxRank: 20 },
    }).expect(200);
    expect(preview.body.applyTiming).toBe('when_resting');

    const saved = await post(`/v1/bots/${botId}/versions`, {
      params: { maxRank: 20 },
    }).expect(201);
    expect(saved.body.appliedAt).toBeNull();

    const again = await post(`/v1/bots/${botId}/versions`, {
      params: { maxRank: 10 },
    }).expect(409);
    expect(again.body.code).toBe('BOT_VERSION_PENDING');
  });

  it('바뀐 값이 없으면 422, 규칙 값 모양이 틀리면 400, 없는 봇은 404예요', async () => {
    const botId = await createBot('invalid');

    const same = await post(`/v1/bots/${botId}/versions`, {
      params: {},
    }).expect(422);
    expect(same.body.code).toBe('BOT_VERSION_UNCHANGED');

    const invalid = await post(`/v1/bots/${botId}/versions`, {
      params: { maxRank: 'many' },
    }).expect(400);
    expect(invalid.body.errors).toEqual([
      expect.objectContaining({ field: 'params.maxRank' }),
    ]);

    await post('/v1/bots/999999/versions', { params: {} }).expect(404);
    await get('/v1/bots/999999/versions').expect(404);
  });
});
