import { type INestApplication, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MarketCalendar } from '@/modules/market-data/entities/market-calendar.entity.js';
import { MarketCalendarRepository } from '@/modules/market-data/market-calendar.repository.js';

import { createTestApp, resetDatabase } from './setup/test-app.js';

// MarketCalendarService는 TossClient(engine 전용)에 기대서, 저장 부분만 실제 Postgres로 확인해요.
@Module({
  imports: [TypeOrmModule.forFeature([MarketCalendar])],
  providers: [MarketCalendarRepository],
})
class CalendarStorageModule {}

describe('장 캘린더 저장 (e2e)', () => {
  let app: INestApplication;
  let calendars: MarketCalendarRepository;
  const fetchedAt = new Date('2026-10-28T23:30:00Z');

  beforeAll(async () => {
    app = await createTestApp([CalendarStorageModule]);
    calendars = app.get(MarketCalendarRepository);
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('같은 거래일을 다시 받으면 덮어써요', async () => {
    await calendars.upsert([
      {
        tradeDate: '2026-10-29',
        isOpen: true,
        regularOpenAt: new Date('2026-10-29T00:00:00Z'),
        regularCloseAt: new Date('2026-10-29T06:30:00Z'),
        fetchedAt,
      },
    ]);
    // 개장 지연일: 10시 개장으로 바뀌었어요
    await calendars.upsert([
      {
        tradeDate: '2026-10-29',
        isOpen: true,
        regularOpenAt: new Date('2026-10-29T01:00:00Z'),
        regularCloseAt: new Date('2026-10-29T06:30:00Z'),
        fetchedAt,
      },
    ]);

    await expect(calendars.findByDate('2026-10-29')).resolves.toMatchObject({
      tradeDate: '2026-10-29',
      isOpen: true,
      regularOpenAt: new Date('2026-10-29T01:00:00Z'),
    });
    await expect(calendars.findByDate('2026-10-30')).resolves.toBeNull();
  });
});
