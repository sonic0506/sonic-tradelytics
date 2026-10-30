import { readFileSync } from 'node:fs';

import { Global, Module } from '@nestjs/common';
import type { z } from 'zod';

import { tickSize } from '@/common/market/tick-size.js';
import { TossClient } from '@/infra/toss/toss.client.js';
import {
  TossSocket,
  type TossSocketHandlers,
} from '@/infra/toss/toss-socket.js';

// scripts/replay-fetch.mjs가 저장한 하루치 시세
interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
interface ReplayData {
  date: string;
  ranked: { symbol: string; rank: number }[];
  candles: Record<string, Bar[]>;
}
interface FakeRequest {
  path: string;
  query?: Record<string, string | number | undefined>;
  result: z.ZodType;
}

const CANDLE_PAGE = 200;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
// YYYY-MM-DD
const DATE_LENGTH = 10;

// 지난 장 1분봉을 "지금"(가짜 시계)까지만 보여 주는 토스예요.
// REST는 그 시각까지의 봉·순위를, 웹소켓은 마지막으로 끝난 봉을 체결·호가로 흘려요
export class ReplayMarket {
  readonly date: string;
  readonly symbols: string[];
  private readonly candles: Record<string, Bar[]>;
  private handlers: TossSocketHandlers | undefined;

  constructor(file: string) {
    const data = JSON.parse(readFileSync(file, 'utf8')) as ReplayData;
    this.date = data.date;
    this.symbols = data.ranked.map(({ symbol }) => symbol);
    this.candles = data.candles;
  }

  connect(handlers: TossSocketHandlers): void {
    this.handlers = handlers;
  }

  // 지금까지 끝난 마지막 봉을 체결(종가)과 호가(종가 / 종가 + 1틱)로 보내요
  push(now: number): void {
    for (const symbol of this.symbols) {
      const bar = this.barsUntil(symbol, now).at(-1);
      if (!bar) continue;
      this.handlers?.onMessage(`trade:kr:${symbol}`, {
        price: String(bar.c),
        volume: String(bar.v),
      });
      this.handlers?.onMessage(`orderbook:kr:${symbol}`, {
        asks: [{ price: String(bar.c + tickSize(bar.c)), volume: '100' }],
        bids: [{ price: String(bar.c), volume: '100' }],
      });
    }
  }

  respond({ path, query = {}, result }: FakeRequest): unknown {
    const now = Date.now();
    if (path === '/api/v1/market-calendar/KR')
      return result.parse(this.calendar());
    if (path === '/api/v1/rankings') return result.parse(this.rankings(now));
    if (path === '/api/v1/candles')
      return result.parse(this.candlePage(query, now));
    if (path === '/api/v1/stocks')
      return result.parse([
        {
          symbol: String(query.symbols),
          koreanMarketDetail: {
            liquidationTrading: false,
            krxTradingSuspended: false,
            nxtTradingSuspended: null,
          },
        },
      ]);
    if (path.endsWith('/warnings')) return result.parse([]);
    // 주문 가능 금액(buying-power) 등
    return result.parse({ currency: 'KRW', cashBuyingPower: '1000000' });
  }

  private barsUntil(symbol: string, now: number): Bar[] {
    return (this.candles[symbol] ?? []).filter(({ t }) => t <= now);
  }

  // 전일·익일은 저장할 때 날짜만 달라야 해서 하루 앞뒤로 둬요 (주말은 신경 쓰지 않아요)
  private calendar(): unknown {
    const day = (offset: number) => {
      const date = new Date(
        new Date(`${this.date}T00:00:00Z`).getTime() + offset * DAY_MS,
      )
        .toISOString()
        .slice(0, DATE_LENGTH);
      return {
        date,
        integrated: {
          regularMarket: {
            startTime: `${date}T09:00:00+09:00`,
            endTime: `${date}T15:30:00+09:00`,
          },
        },
      };
    };
    return {
      today: day(0),
      previousBusinessDay: day(-1),
      nextBusinessDay: day(1),
    };
  }

  // 지금까지의 누적 거래대금(종가 × 거래량) 순위
  private rankings(now: number): unknown {
    const ranked = this.symbols
      .map((symbol) => ({
        symbol,
        amount: this.barsUntil(symbol, now).reduce(
          (sum, { c, v }) => sum + c * v,
          0,
        ),
      }))
      .filter(({ amount }) => amount > 0)
      .sort((a, b) => b.amount - a.amount);
    return {
      rankedAt: new Date(now).toISOString(),
      rankings: ranked.map(({ symbol }, index) => ({
        rank: index + 1,
        symbol,
        currency: 'KRW',
        price: { lastPrice: '0', basePrice: '0', changeRate: null },
        tradingVolume: '0',
        tradingAmount: '0',
      })),
    };
  }

  // 최신 봉부터 before(없으면 지금)까지 200개씩
  private candlePage(
    query: Record<string, string | number | undefined>,
    now: number,
  ): unknown {
    const until =
      query.before === undefined
        ? now
        : Math.min(now, new Date(String(query.before)).getTime());
    const bars = this.barsUntil(String(query.symbol), until).reverse();
    const page = bars.slice(0, CANDLE_PAGE);
    const oldest = page.at(-1);
    return {
      candles: page.map(({ t, o, h, l, c, v }) => ({
        timestamp: new Date(t).toISOString(),
        openPrice: String(o),
        highPrice: String(h),
        lowPrice: String(l),
        closePrice: String(c),
        volume: String(v),
        currency: 'KRW',
      })),
      nextBefore:
        oldest && bars.length > CANDLE_PAGE
          ? new Date(oldest.t - MINUTE_MS).toISOString()
          : null,
    };
  }
}

let current: ReplayMarket | undefined;

export function loadReplay(file: string): ReplayMarket {
  current = new ReplayMarket(file);
  return current;
}

const market = (): ReplayMarket => {
  if (!current) throw new Error('loadReplay를 먼저 불러요');
  return current;
};

@Global()
@Module({
  providers: [
    {
      provide: TossClient,
      useValue: {
        request: (options: FakeRequest) =>
          Promise.resolve(market().respond(options)),
        ensureToken: () => Promise.resolve(),
      },
    },
    {
      provide: TossSocket,
      useValue: {
        connect: (handlers: TossSocketHandlers) => {
          market().connect(handlers);
        },
        declare: () => undefined,
        close: () => undefined,
      },
    },
  ],
  exports: [TossClient, TossSocket],
})
export class ReplayTossModule {}
