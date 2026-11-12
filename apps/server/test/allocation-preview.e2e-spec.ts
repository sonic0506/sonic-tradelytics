import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot, BotVersion } from '@/modules/bot/index.js';
import { EngineStatus } from '@/modules/engine-state/index.js';
import { Allocation } from '@/modules/fund/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// 배분 미리보기 (api.md POST /v1/allocation-previews, FR-BOT-05)
describe('POST /v1/allocation-previews (e2e)', () => {
  let app: INestApplication;
  let waitingId: number;
  const preview = (body: object) =>
    request(app.getHttpServer())
      .post('/v1/allocation-previews')
      .set('Authorization', bearer(app))
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
    const dataSource = app.get(DataSource);
    await resetDatabase(app);
    const base = {
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      budgetType: 'fixed' as const,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-11-09',
      onPeriodEnd: 'liquidate' as const,
    };
    const [running, waiting] = await dataSource.getRepository(Bot).save([
      {
        ...base,
        name: 'running',
        status: 'running' as const,
        budgetAmount: 100_000,
        startPriority: 1,
      },
      {
        ...base,
        name: 'waiting',
        status: 'ready' as const,
        stage: 'released' as const,
        budgetAmount: 150_000,
        startPriority: 2,
      },
      {
        ...base,
        name: 'ratio',
        status: 'ready' as const,
        budgetType: 'ratio' as const,
        budgetRatio: 0.8,
        tradingStart: '10:00',
        startPriority: 3,
      },
    ]);
    if (!running || !waiting) throw new Error('봇을 만들지 못했어요');
    waitingId = waiting.id;
    await dataSource.getRepository(BotVersion).save(
      [running, waiting].map((bot) => ({
        botId: bot.id,
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
    const snapshot = await dataSource.getRepository(AccountSnapshot).save({
      takenAt: new Date('2026-11-09T08:59:00+09:00'),
      orderableCash: 210_000,
      runningBotsCashShare: 0,
    });
    await dataSource.getRepository(Allocation).save({
      botId: running.id,
      snapshotId: snapshot.id,
      amount: 100_000,
      capped: false,
    });
    await dataSource.getRepository(EngineStatus).save({
      id: 1,
      state: 'running',
      orderableCash: 300_000,
      holdingsValue: 0,
      accountSyncedAt: new Date('2026-11-12T01:00:00Z'),
      heartbeatAt: new Date(),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('같은 시각에 시작하는 확정 전 봇과 함께, 실행 중 봇의 현금 몫을 뺀 운용 자산으로 계산해요', async () => {
    const response = await preview({
      budget: { type: 'fixed', value: 100_000 },
      periodStart: '2026-11-13',
      tradingStart: '09:05',
    }).expect(200);

    // 300,000 − 실행 중 봇 현금 몫 100,000 = 200,000. 먼저인 waiting이 150,000을 받고 새 봇은 보류돼요
    expect(response.body).toEqual({
      basedAt: '2026-11-12T01:00:00.000Z',
      capital: 200_000,
      startAt: '2026-11-13T00:05:00.000Z',
      ratioTotal: 0,
      items: [
        {
          botId: String(waitingId),
          name: 'waiting',
          budget: { type: 'fixed', value: 150_000 },
          amount: 150_000,
          outcome: 'confirmed',
        },
        {
          botId: null,
          name: null,
          budget: { type: 'fixed', value: 100_000 },
          amount: null,
          outcome: 'pending',
        },
      ],
    });
  });

  it('새 봇은 검증 구간 상한까지만 확정 예정이에요', async () => {
    const response = await preview({
      budget: { type: 'ratio', value: 0.1 },
      periodStart: '2026-11-13',
      tradingStart: '10:00',
    }).expect(200);

    expect(response.body.ratioTotal).toBe(0.9);
    expect(response.body.items.at(-1)).toMatchObject({
      outcome: 'confirmed',
      amount: 20_000,
    });
  });

  it('정률 합이 100%를 넘으면 새 봇은 저장 불가예요', async () => {
    const response = await preview({
      budget: { type: 'ratio', value: 0.3 },
      periodStart: '2026-11-13',
      tradingStart: '10:00',
    }).expect(200);

    expect(response.body.ratioTotal).toBe(1.1);
    expect(response.body.items.at(-1)).toEqual({
      botId: null,
      name: null,
      budget: { type: 'ratio', value: 0.3 },
      amount: null,
      outcome: 'blocked',
    });
  });

  it('시각 형식이 틀리면 422, 몸체가 틀리면 400이에요', async () => {
    await preview({
      budget: { type: 'fixed', value: 100_000 },
      periodStart: '2026-11-13',
      tradingStart: 'nine',
    }).expect(422);
    await preview({ budget: { type: 'fixed' } }).expect(400);
  });
});
