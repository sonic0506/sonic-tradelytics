import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 봇 만들기 (F1, api.md 봇): 기본값과 생성 검사
describe('봇 만들기 (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  const body = (fields: Record<string, unknown> = {}) => ({
    name: 'day-1',
    type: 'day',
    riskProfile: 'neutral',
    budget: { type: 'ratio', value: 0.6 },
    startPriority: null,
    orderAmount: 50_000,
    splitCount: 1,
    maxPositions: 2,
    period: { start: '2026-11-02', end: null, onEnd: 'liquidate' },
    tradingHours: { start: '09:05', end: '15:20' },
    params: { maxRank: 20, exitAt: '15:10' },
    lossStop: { first: 4, total: 10 },
    stopStreak: 3,
    onDailyLimit: 'liquidate',
    ...fields,
  });
  const create = (payload: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/v1/bots')
      .set('Authorization', bearer(app))
      .send(payload);

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('데이 트레이딩·중립 기본값은 규칙 칸과 손실 중지 -4%·-10%를 채워요', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/bot-defaults?type=day&riskProfile=neutral')
      .set('Authorization', bearer(app))
      .expect(200);

    expect(response.body).toMatchObject({
      capAmount: 100_000,
      budget: { type: 'fixed', value: 100_000 },
      orderAmount: 50_000,
      tradingHours: { start: '09:05', end: '15:20' },
      lossStop: { first: 4, total: 10 },
      stopStreak: 3,
      onDailyLimit: 'liquidate',
    });
    expect(response.body.rules).toContainEqual({
      key: 'exitAt',
      group: 'exit',
      label: '장 마감 전 청산',
      kind: 'time',
      unit: null,
      value: '15:15',
    });
  });

  it('전략이 없는 유형은 422, 모르는 성향은 400이에요', async () => {
    const swing = await request(app.getHttpServer())
      .get('/v1/bot-defaults?type=swing&riskProfile=neutral')
      .set('Authorization', bearer(app))
      .expect(422);
    expect(swing.body).toMatchObject({ code: 'BOT_TYPE_NOT_SUPPORTED' });
    await request(app.getHttpServer())
      .get('/v1/bot-defaults?type=day&riskProfile=brave')
      .set('Authorization', bearer(app))
      .expect(400);
  });

  it('봇과 첫 버전을 검증 중·시작 전으로 저장하고 규칙 값의 시각을 HH:mm:ss로 맞춰요', async () => {
    const response = await create(body()).expect(201);

    const bot = await dataSource
      .getRepository(Bot)
      .findOneByOrFail({ id: Number(response.body.id) });
    expect(bot).toMatchObject({
      name: 'day-1',
      type: 'day',
      stage: 'verifying',
      status: 'ready',
      budgetType: 'ratio',
      budgetRatio: 0.6,
      budgetAmount: null,
      tradingStart: '09:05:00',
      tradingEnd: '15:20:00',
      periodStart: '2026-11-02',
    });
    await expect(
      dataSource.getRepository(BotVersion).findOneByOrFail({ botId: bot.id }),
    ).resolves.toMatchObject({
      version: 1,
      changeKind: 'initial',
      orderSizeType: 'fixed',
      orderSizeValue: 50_000,
      dailyLossPct: 4,
      totalLossPct: 10,
      params: expect.objectContaining({ maxRank: 20, exitAt: '15:10:00' }),
    });
  });

  it('같은 시각에 시작하는 정률 합이 100%를 넘으면 422예요', async () => {
    const response = await create(
      body({ name: 'day-2', budget: { type: 'ratio', value: 0.5 } }),
    ).expect(422);

    expect(response.body).toMatchObject({ code: 'BUDGET_RATIO_EXCEEDED' });
  });

  // 08:50~15:00
  it('운영 시간이 정규장 밖이면 422예요', async () => {
    const response = await create(
      body({ name: 'day-3', tradingHours: { start: '08:50', end: '15:00' } }),
    ).expect(422);

    expect(response.body).toMatchObject({
      code: 'TRADING_HOURS_OUT_OF_RANGE',
    });
  });

  it('모르는 규칙 키나 틀린 모양은 400 VALIDATION_FAILED와 필드를 돌려줘요', async () => {
    const response = await create(
      body({ name: 'day-4', params: { turnoverSurge: 2 } }),
    ).expect(400);

    expect(response.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(response.body.errors).toEqual([
      expect.objectContaining({ field: 'params' }),
    ]);
  });

  it('정액 봇은 정률 합과 관계없이 만들고, 처음 순서를 고르면 맨 앞이에요', async () => {
    const response = await create(
      body({
        name: 'day-5',
        budget: { type: 'fixed', value: 100_000 },
        startPriority: 'first',
      }),
    ).expect(201);

    await expect(
      dataSource
        .getRepository(Bot)
        .findOneByOrFail({ id: Number(response.body.id) }),
      // 먼저 만든 봇(우선순위 1)보다 앞이에요
    ).resolves.toMatchObject({ budgetAmount: 100_000, startPriority: -1 });
  });
});
