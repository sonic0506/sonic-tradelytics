import { Injectable } from '@nestjs/common';
import { z } from 'zod';

import { TossClient } from '@/infra/toss/toss.client.js';

import {
  type IntradayStats,
  intradayStats,
  type MinuteCandle,
} from './intraday.rule.js';
import { MarketCalendarService } from './market-calendar.service.js';

const decimal = z.coerce.number();
const rankingSchema = z.object({
  rankings: z.array(z.object({ rank: z.number(), symbol: z.string() })),
});
const candleSchema = z.object({
  candles: z.array(
    z.object({
      timestamp: z.coerce.date(),
      openPrice: decimal,
      highPrice: decimal,
      lowPrice: decimal,
      closePrice: decimal,
      volume: decimal,
    }),
  ),
  nextBefore: z.string().nullable().optional(),
});
const stocksSchema = z.array(
  z.object({
    symbol: z.string(),
    koreanMarketDetail: z
      .object({
        liquidationTrading: z.boolean(),
        krxTradingSuspended: z.boolean(),
        nxtTradingSuspended: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
);
const warningsSchema = z.array(z.object({ warningType: z.string() }));

export interface RankedSymbol {
  symbol: string;
  rank: number;
}

// 진입 금지 판단 재료 (POL-RISK-06). risk의 entryBanReason에 그대로 넘겨요
export interface StockStatus {
  warnings: string[];
  liquidationTrading: boolean;
  krxTradingSuspended: boolean;
  nxtTradingSuspended: boolean | null;
}

// 봇의 진입 후보와 판단 재료(시가·VWAP, 매수 유의사항)를 토스 REST로 받아요.
// 실시간 가격은 MarketCollector 스냅샷을 써요 (ADR-0007)
@Injectable()
export class MarketScanService {
  // 웹소켓 구독 한도(50종목) 안에서 후보를 받아요
  static readonly RANK_COUNT = 50;
  // 시가·VWAP는 1분봉이라 1분마다 다시 받아요
  private static readonly INTRADAY_TTL_MS = 60_000;
  // 1분봉 한 번에 최대 200개
  private static readonly CANDLE_PAGE = 200;
  // 판단용 호출이라 한도를 오래 기다리지 않아요 (NFR-03)
  private static readonly WAIT_MS = 1000;

  private readonly intraday = new Map<
    string,
    { stats: IntradayStats | null; fetchedAt: number }
  >();

  constructor(
    private readonly toss: TossClient,
    private readonly calendar: MarketCalendarService,
  ) {}

  // 거래대금 실시간 순위 (투자 유의 종목 제외)
  async rankByTradingAmount(): Promise<RankedSymbol[]> {
    const { rankings } = await this.toss.request({
      group: 'RANKING',
      path: '/api/v1/rankings',
      query: {
        type: 'MARKET_TRADING_AMOUNT',
        marketCountry: 'KR',
        duration: 'realtime',
        excludeInvestmentCaution: 'true',
        count: MarketScanService.RANK_COUNT,
      },
      waitMs: MarketScanService.WAIT_MS,
      result: rankingSchema,
    });
    return rankings.map(({ symbol, rank }) => ({ symbol, rank }));
  }

  // 오늘 정규장 시가와 VWAP. 1분 안에 받은 값은 다시 받지 않아요. 정규장이 아니거나 거래가 없으면 null
  async intradayStats(
    symbol: string,
    now: number = Date.now(),
  ): Promise<IntradayStats | null> {
    const cached = this.intraday.get(symbol);
    if (cached && now - cached.fetchedAt < MarketScanService.INTRADAY_TTL_MS)
      return cached.stats;
    const session = this.calendar.regularSession();
    if (!session) return null;
    const stats = intradayStats(
      await this.candlesSince(symbol, session.openAt),
      session,
    );
    this.intraday.set(symbol, { stats, fetchedAt: now });
    return stats;
  }

  // 매수 유의사항과 거래정지·정리매매 (진입 직전에만 불러요)
  async stockStatus(symbol: string): Promise<StockStatus> {
    const [stocks, warnings] = await Promise.all([
      this.toss.request({
        group: 'STOCK',
        path: '/api/v1/stocks',
        query: { symbols: symbol },
        waitMs: MarketScanService.WAIT_MS,
        result: stocksSchema,
      }),
      this.toss.request({
        group: 'STOCK',
        path: `/api/v1/stocks/${encodeURIComponent(symbol)}/warnings`,
        waitMs: MarketScanService.WAIT_MS,
        result: warningsSchema,
      }),
    ]);
    const detail = stocks.find(
      (stock) => stock.symbol === symbol,
    )?.koreanMarketDetail;
    return {
      warnings: warnings.map(({ warningType }) => warningType),
      liquidationTrading: detail?.liquidationTrading ?? false,
      // 종목 정보가 없으면 거래정지로 봐서 막아요
      krxTradingSuspended: detail?.krxTradingSuspended ?? true,
      nxtTradingSuspended: detail?.nxtTradingSuspended ?? null,
    };
  }

  // 더 보지 않는 종목의 시가·VWAP를 지워요
  forget(keep: Set<string>): void {
    for (const symbol of this.intraday.keys())
      if (!keep.has(symbol)) this.intraday.delete(symbol);
  }

  // 최신 봉부터 정규장 시작 전 봉이 나올 때까지 이어 받아요 (하루 390개라 많아야 2번)
  private async candlesSince(
    symbol: string,
    since: Date,
    before?: string,
  ): Promise<MinuteCandle[]> {
    const page = await this.toss.request({
      group: 'MARKET_DATA_CHART',
      path: '/api/v1/candles',
      query: {
        symbol,
        interval: '1m',
        count: MarketScanService.CANDLE_PAGE,
        before,
      },
      waitMs: MarketScanService.WAIT_MS,
      result: candleSchema,
    });
    const oldest = page.candles.at(-1);
    if (!oldest || !page.nextBefore || oldest.timestamp <= since)
      return page.candles;
    return [
      ...page.candles,
      ...(await this.candlesSince(symbol, since, page.nextBefore)),
    ];
  }
}
