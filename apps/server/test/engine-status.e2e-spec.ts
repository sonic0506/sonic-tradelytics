import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { kstDate } from '@/common/time/kst-date.js';
import { EngineStatus } from '@/modules/engine-state/index.js';
import { MarketCalendar } from '@/modules/market-data/index.js';

import { bearer, createTestApp, resetDatabase } from './setup/test-app.js';

// api는 토스를 부르지 않고 engine이 쓴 engine_statuses와 market_calendars를 읽어요 (ADR-0002)
describe('GET /v1/engine-status', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const get = () =>
    request(app.getHttpServer())
      .get('/v1/engine-status')
      .set('Authorization', bearer(app));

  beforeAll(async () => {
    app = await createTestApp();
    dataSource = app.get(DataSource);
    await resetDatabase(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('engine이 한 번도 쓰지 않았으면 404예요', async () => {
    const response = await get().expect(404);

    expect(response.body).toMatchObject({ code: 'ENGINE_STATUS_NOT_FOUND' });
  });

  it('engine이 쓴 상태와 오늘 정규장 시각을 돌려줘요', async () => {
    const heartbeatAt = new Date('2026-10-30T01:00:00Z');
    await dataSource.getRepository(EngineStatus).save({
      id: 1,
      state: 'halted',
      haltReasons: ['kill'],
      staleSymbols: ['005930'],
      orderableCash: null,
      holdingsValue: null,
      accountSyncedAt: null,
      heartbeatAt,
    });
    const today = kstDate();
    await dataSource.getRepository(MarketCalendar).save({
      tradeDate: today,
      isOpen: true,
      regularOpenAt: new Date(`${today}T09:00:00+09:00`),
      regularCloseAt: new Date(`${today}T15:30:00+09:00`),
      fetchedAt: heartbeatAt,
    });

    const response = await get().expect(200);

    expect(response.body).toEqual({
      state: 'halted',
      haltReasons: ['kill'],
      heartbeatAt: heartbeatAt.toISOString(),
      staleSymbols: ['005930'],
      marketOpen: {
        isTradingDay: true,
        openAt: new Date(`${today}T09:00:00+09:00`).toISOString(),
        closeAt: new Date(`${today}T15:30:00+09:00`).toISOString(),
      },
    });
  });
});
