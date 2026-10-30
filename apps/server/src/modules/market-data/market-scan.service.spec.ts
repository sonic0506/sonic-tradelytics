import { Test } from '@nestjs/testing';
import type { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

import { MarketCalendarService } from './market-calendar.service.js';
import { MarketScanService } from './market-scan.service.js';

interface Call {
  path: string;
  query?: Record<string, string | number | undefined>;
  result: z.ZodType;
}

describe('MarketScanService', () => {
  const toss = { request: vi.fn<(options: Call) => Promise<unknown>>() };
  const calendar = {
    regularSession: vi.fn<MarketCalendarService['regularSession']>(),
  };
  let service: MarketScanService;

  const session = {
    openAt: new Date('2026-10-30T09:00:00+09:00'),
    closeAt: new Date('2026-10-30T15:30:00+09:00'),
  };
  const candle = (time: string, price: number) => ({
    timestamp: `2026-10-30T${time}:00.000+09:00`,
    openPrice: String(price),
    highPrice: String(price),
    lowPrice: String(price),
    closePrice: String(price),
    volume: '100',
    currency: 'KRW',
  });
  // 경로마다 정한 응답을 TossClient처럼 스키마로 검증해 돌려줘요
  const respond = (byPath: (call: Call) => unknown): void => {
    toss.request.mockImplementation((call) =>
      Promise.resolve(call.result.parse(byPath(call))),
    );
  };
  const calls = (path: string) =>
    toss.request.mock.calls.filter(([call]) => call.path === path);

  beforeEach(async () => {
    vi.resetAllMocks();
    calendar.regularSession.mockReturnValue(session);
    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketScanService,
        { provide: TossClient, useValue: toss },
        { provide: MarketCalendarService, useValue: calendar },
      ],
    }).compile();
    service = moduleRef.get(MarketScanService);
  });

  it('거래대금 실시간 순위를 투자 유의 종목을 빼고 받아요', async () => {
    respond(() => ({
      rankedAt: '2026-10-30T10:00:00+09:00',
      rankings: [
        {
          rank: 1,
          symbol: '005930',
          currency: 'KRW',
          price: { lastPrice: '70000', basePrice: '69000', changeRate: '0.01' },
          tradingVolume: '1',
          tradingAmount: '1',
        },
      ],
    }));

    await expect(service.rankByTradingAmount()).resolves.toEqual([
      { symbol: '005930', rank: 1 },
    ]);
    const [call] = toss.request.mock.lastCall ?? [];
    expect(call?.query).toMatchObject({
      type: 'MARKET_TRADING_AMOUNT',
      duration: 'realtime',
      excludeInvestmentCaution: 'true',
    });
  });

  it('정규장 시작 전 봉이 나올 때까지 1분봉을 이어 받아 시가·VWAP를 구하고 1분 동안 다시 받지 않아요', async () => {
    respond(({ query }) =>
      query?.before === undefined
        ? {
            candles: [candle('12:30', 10_200), candle('12:29', 10_200)],
            nextBefore: '2026-10-30T12:28:00+09:00',
          }
        : {
            candles: [candle('09:01', 10_000), candle('08:59', 9_000)],
            nextBefore: '2026-10-30T08:58:00+09:00',
          },
    );
    const now = Date.parse('2026-10-30T12:30:30+09:00');

    const stats = await service.intradayStats('005930', now);
    expect(stats?.openPrice).toBe(10_000);
    expect(stats?.vwap).toBeCloseTo(10_133.33, 2);
    await service.intradayStats('005930', now + 59_000);
    expect(calls('/api/v1/candles')).toHaveLength(2);

    await service.intradayStats('005930', now + 60_000);
    expect(calls('/api/v1/candles')).toHaveLength(4);
  });

  it('정규장이 아니면 1분봉을 받지 않아요', async () => {
    calendar.regularSession.mockReturnValue(null);

    await expect(service.intradayStats('005930')).resolves.toBeNull();
    expect(toss.request).not.toHaveBeenCalled();
  });

  it('더 보지 않는 종목의 시가·VWAP는 지워서 다음에 다시 받아요', async () => {
    respond(() => ({ candles: [candle('09:01', 10_000)], nextBefore: null }));
    const now = Date.parse('2026-10-30T10:00:00+09:00');
    await service.intradayStats('005930', now);

    service.forget(new Set(['000660']));
    await service.intradayStats('005930', now + 1_000);

    expect(calls('/api/v1/candles')).toHaveLength(2);
  });

  it('매수 유의사항과 거래정지·정리매매를 모아요', async () => {
    respond(({ path }) =>
      path === '/api/v1/stocks'
        ? [
            {
              symbol: '005930',
              koreanMarketDetail: {
                liquidationTrading: false,
                nxtSupported: true,
                krxTradingSuspended: false,
                nxtTradingSuspended: false,
              },
            },
          ]
        : [{ warningType: 'VI_STATIC', exchange: 'KRX' }],
    );

    await expect(service.stockStatus('005930')).resolves.toEqual({
      warnings: ['VI_STATIC'],
      liquidationTrading: false,
      krxTradingSuspended: false,
      nxtTradingSuspended: false,
    });
  });

  it('종목 정보가 없으면 거래정지로 봐요', async () => {
    respond(() => []);

    await expect(service.stockStatus('005930')).resolves.toMatchObject({
      krxTradingSuspended: true,
    });
  });
});
