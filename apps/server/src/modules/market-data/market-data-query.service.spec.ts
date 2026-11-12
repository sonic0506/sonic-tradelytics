import { Test } from '@nestjs/testing';

import type { QuoteCache } from './entities/quote-cache.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';
import { MarketCalendarQueryService } from './market-calendar-query.service.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';
import { QuoteQueryService } from './quote-query.service.js';

describe('MarketDataQuery (장 일정·최근가 읽기)', () => {
  const calendars = {
    findByDate: vi.fn<MarketCalendarRepository['findByDate']>(),
    findNextOpen: vi.fn<MarketCalendarRepository['findNextOpen']>(),
    countOpen: vi.fn<MarketCalendarRepository['countOpen']>(),
    findRecentOpen: vi.fn<MarketCalendarRepository['findRecentOpen']>(),
  };
  const quotes = {
    findBySymbols: vi.fn<QuoteCacheRepository['findBySymbols']>(),
  };
  let calendar: MarketCalendarQueryService;
  let quote: QuoteQueryService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketCalendarQueryService,
        QuoteQueryService,
        { provide: MarketCalendarRepository, useValue: calendars },
        { provide: QuoteCacheRepository, useValue: quotes },
      ],
    }).compile();
    calendar = moduleRef.get(MarketCalendarQueryService);
    quote = moduleRef.get(QuoteQueryService);
  });

  it('장 일정은 repository에 그대로 물어봐요', async () => {
    calendars.findByDate.mockResolvedValue(null);
    calendars.findNextOpen.mockResolvedValue(null);
    calendars.countOpen.mockResolvedValue(3);

    await calendar.findDay('2026-10-30');
    await calendar.findNextOpen('2026-10-30');

    await expect(
      calendar.countOpenDays('2026-10-28', '2026-10-30'),
    ).resolves.toBe(3);
    expect(calendars.findNextOpen).toHaveBeenCalledWith('2026-10-30');
  });

  it('최근가는 종목 → 가격으로 주고, 종목이 없으면 조회하지 않아요', async () => {
    quotes.findBySymbols.mockResolvedValue([
      Object.assign({ symbol: '005930', price: 70_000 }) as QuoteCache,
    ]);

    await expect(quote.pricesOf(['005930', '000660'])).resolves.toEqual(
      new Map([['005930', 70_000]]),
    );
    await expect(quote.pricesOf([])).resolves.toEqual(new Map());
    expect(quotes.findBySymbols).toHaveBeenCalledOnce();
  });

  it('최근 개장일과 받은 시각이 있는 최근가도 repository 값 그대로 줘요', async () => {
    calendars.findRecentOpen.mockResolvedValue(['2026-11-12', '2026-11-11']);
    const cached = Object.assign({
      symbol: '005930',
      price: 70_000,
      receivedAt: new Date('2026-11-12T01:00:00Z'),
    }) as QuoteCache;
    quotes.findBySymbols.mockResolvedValue([cached]);

    await expect(calendar.recentOpenDays('2026-11-12', 2)).resolves.toEqual([
      '2026-11-12',
      '2026-11-11',
    ]);
    expect(calendars.findRecentOpen).toHaveBeenCalledWith('2026-11-12', 2);
    await expect(quote.quotesOf(['005930'])).resolves.toEqual(
      new Map([['005930', cached]]),
    );
    await expect(quote.quotesOf([])).resolves.toEqual(new Map());
  });
});
