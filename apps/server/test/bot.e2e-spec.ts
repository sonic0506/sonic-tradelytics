import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot } from '@/modules/bot/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

describe('GET /v1/bots/options', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
    await resetDatabase(app);
    const base = {
      type: 'day' as const,
      riskProfile: 'neutral' as const,
      budgetType: 'fixed' as const,
      budgetAmount: 100_000,
      startPriority: 1,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-10-29',
      onPeriodEnd: 'liquidate' as const,
    };
    await app
      .get(DataSource)
      .getRepository(Bot)
      .save([
        { ...base, name: 'first', status: 'running' as const },
        { ...base, name: 'ended', status: 'stopped' as const },
      ]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('끝난 봇까지 모든 봇을 { value: id, label: 이름 }으로 줘요', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/bots/options')
      .set('Authorization', bearer(app))
      .expect(200);

    expect(response.body).toEqual([
      { value: expect.stringMatching(/^\d+$/), label: 'first' },
      { value: expect.stringMatching(/^\d+$/), label: 'ended' },
    ]);
  });
});
