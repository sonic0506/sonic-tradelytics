import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { Bot } from '@/modules/bot/index.js';
import { RiskEvent } from '@/modules/risk/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

describe('GET /v1/risk-events', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let botId: number;
  const get = (query: string) =>
    request(app.getHttpServer())
      .get(`/v1/risk-events${query}`)
      .set('Authorization', bearer(app));

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(app);
    const bot = await dataSource.getRepository(Bot).save({
      name: 'day',
      type: 'day_trading',
      riskProfile: 'neutral',
      status: 'paused',
      budgetType: 'fixed',
      budgetAmount: 100_000,
      startPriority: 1,
      tradingStart: '09:05',
      tradingEnd: '15:20',
      periodStart: '2026-10-29',
      onPeriodEnd: 'liquidate',
    });
    botId = bot.id;
    // 10-29 저녁(KST), 10-30 오전, 10-30 장 마감 뒤
    await dataSource.getRepository(RiskEvent).save([
      {
        kind: 'feed_stale',
        botId: null,
        occurredAt: new Date('2026-10-29T10:00:00Z'),
        detail: {},
      },
      {
        kind: 'daily_stop',
        botId,
        occurredAt: new Date('2026-10-30T01:00:00Z'),
        detail: { amount: 100_000, dailyPnl: -4_000 },
      },
      {
        kind: 'batch_fail',
        botId: null,
        occurredAt: new Date('2026-10-30T06:40:00Z'),
        detail: { job: 'post_close' },
      },
    ]);
  });
  afterAll(async () => {
    await app.close();
  });

  it('최신순으로 봇 이름·상세·알림 여부와 함께 페이지로 돌려줘요', async () => {
    const response = await get('?size=2').expect(200);

    expect(response.body).toMatchObject({
      items: [
        { kind: 'batch_fail', botId: null, botName: null, notifiedAt: null },
        {
          kind: 'daily_stop',
          botId: String(botId),
          botName: 'day',
          detail: { amount: 100_000, dailyPnl: -4_000 },
        },
      ],
      meta: { page: 1, size: 2, total: 3 },
    });
  });

  it('봇·종류·거래일(KST)로 걸러요', async () => {
    const byBot = await get(`?botIds=${botId}`).expect(200);
    expect(byBot.body.meta).toMatchObject({ total: 1 });

    const byKinds = await get('?kinds=feed_stale,batch_fail').expect(200);
    expect(byKinds.body.meta).toMatchObject({ total: 2 });

    const byDay = await get('?from=2026-10-30&to=2026-10-30').expect(200);
    expect(byDay.body.meta).toMatchObject({ total: 2 });
  });

  it('모르는 종류나 날짜 형식이면 400이에요', async () => {
    await get('?kinds=unknown').expect(400);
    await get('?from=20261030').expect(400);
  });
});
