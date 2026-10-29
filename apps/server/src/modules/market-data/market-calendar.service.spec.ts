import { Test } from '@nestjs/testing';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

import type { MarketCalendar } from './entities/market-calendar.entity.js';
import { MarketCalendarRepository } from './market-calendar.repository.js';
import { MarketCalendarService } from './market-calendar.service.js';

describe('MarketCalendarService', () => {
  const toss = {
    request: vi.fn<(options: { result: z.ZodType }) => Promise<unknown>>(),
  };
  // TossClient처럼 응답 result를 넘겨받은 스키마로 검증해 돌려줘요
  const respond = (raw: unknown): void => {
    toss.request.mockImplementation(({ result }) =>
      Promise.resolve(result.parse(raw)),
    );
  };
  const calendars = {
    findByDate: vi.fn<MarketCalendarRepository['findByDate']>(),
    upsert: vi.fn<MarketCalendarRepository['upsert']>(),
  };
  let service: MarketCalendarService;

  // 2026-10-29(목) 10:00 KST
  const now = new Date('2026-10-29T01:00:00Z');
  const regular = (date: string) => ({
    date,
    integrated: {
      preMarket: null,
      regularMarket: {
        startTime: `${date}T09:00:00+09:00`,
        singlePriceAuctionStartTime: `${date}T15:20:00+09:00`,
        endTime: `${date}T15:30:00+09:00`,
      },
      afterMarket: null,
    },
  });
  const openToday: MarketCalendar = {
    tradeDate: '2026-10-29',
    isOpen: true,
    regularOpenAt: new Date('2026-10-29T00:00:00Z'),
    regularCloseAt: new Date('2026-10-29T06:30:00Z'),
    fetchedAt: now,
    createdAt: now,
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.useFakeTimers({ now, toFake: ['Date'] });
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketCalendarService,
        { provide: TossClient, useValue: toss },
        { provide: MarketCalendarRepository, useValue: calendars },
      ],
    }).compile();
    service = moduleRef.get(MarketCalendarService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('오늘 캘린더가 DB에 있으면 토스를 부르지 않아요', async () => {
    calendars.findByDate.mockResolvedValue(openToday);

    await expect(service.ensureToday()).resolves.toBe(openToday);

    expect(calendars.findByDate).toHaveBeenCalledWith('2026-10-29');
    expect(toss.request).not.toHaveBeenCalled();
  });

  it('없으면 토스에서 받아 전일·당일·익일을 저장해요', async () => {
    calendars.findByDate.mockResolvedValue(null);
    respond({
      today: regular('2026-10-29'),
      previousBusinessDay: regular('2026-10-28'),
      nextBusinessDay: regular('2026-10-30'),
    });

    await expect(service.ensureToday()).resolves.toMatchObject({
      tradeDate: '2026-10-29',
      isOpen: true,
      regularOpenAt: new Date('2026-10-29T00:00:00Z'),
      regularCloseAt: new Date('2026-10-29T06:30:00Z'),
    });

    expect(toss.request).toHaveBeenCalledWith(
      expect.objectContaining({
        group: 'MARKET_INFO',
        path: '/api/v1/market-calendar/KR',
        query: { date: '2026-10-29' },
      }),
    );
    expect(
      calendars.upsert.mock.calls[0]?.[0].map(({ tradeDate }) => tradeDate),
    ).toEqual(['2026-10-28', '2026-10-29', '2026-10-30']);
  });

  it('정규장이 null인 날은 휴장으로 저장해요', async () => {
    calendars.findByDate.mockResolvedValue(null);
    respond({
      today: { date: '2026-10-29', integrated: null },
      previousBusinessDay: regular('2026-10-28'),
      nextBusinessDay: regular('2026-10-30'),
    });

    await expect(service.ensureToday()).resolves.toMatchObject({
      isOpen: false,
      regularOpenAt: null,
      regularCloseAt: null,
    });
    expect(service.isRegularSession()).toBe(false);
  });

  it('토스 호출이 실패하면 던져요', async () => {
    calendars.findByDate.mockResolvedValue(null);
    toss.request.mockRejectedValue(new Error('toss down'));

    await expect(service.ensureToday()).rejects.toThrow('toss down');
  });

  it.each([
    ['개장 전', '2026-10-28T23:59:59Z', false],
    ['개장 시각', '2026-10-29T00:00:00Z', true],
    ['장중', '2026-10-29T01:00:00Z', true],
    ['마감 시각', '2026-10-29T06:30:00Z', false],
  ])('%s(%s)에는 정규장 여부가 %s예요', async (_, at, expected) => {
    calendars.findByDate.mockResolvedValue(openToday);
    await service.ensureToday();

    expect(service.isRegularSession(new Date(at))).toBe(expected);
  });

  it('캘린더를 받기 전이거나 날짜가 바뀌면 정규장이 아니라고 보고 다시 받아요', async () => {
    calendars.findByDate.mockResolvedValue(openToday);

    expect(service.isRegularSession()).toBe(false);
    await vi.waitFor(() => {
      expect(calendars.findByDate).toHaveBeenCalledOnce();
    });
    await vi.waitFor(() => {
      expect(service.isRegularSession()).toBe(true);
    });
  });

  it('다시 받기가 실패해도 던지지 않고 정규장이 아니라고 봐요', async () => {
    calendars.findByDate.mockRejectedValue(new Error('db down'));

    expect(service.isRegularSession()).toBe(false);
    await vi.waitFor(() => {
      expect(calendars.findByDate).toHaveBeenCalledOnce();
    });
    expect(service.isRegularSession()).toBe(false);
  });
});
