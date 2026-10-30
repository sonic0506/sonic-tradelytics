import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { env } from '@/config/env.js';
import { TossClient } from '@/infra/toss/toss.client.js';
import { TossSocket } from '@/infra/toss/toss-socket.js';

import type {
  MarketSnapshot,
  OrderStreamHandlers,
} from './market-data.types.js';
import { QuoteCacheRepository } from './quote-cache.repository.js';

// 웹소켓 숫자는 문자열이에요("price":"230000")
const decimal = z.coerce.number();
const level = z.object({ price: decimal, volume: decimal });
const tradeSchema = z.object({ price: decimal, volume: decimal });
const orderbookSchema = z.object({
  asks: z.array(level),
  bids: z.array(level),
});
const pricesSchema = z.array(
  z.object({ symbol: z.string(), lastPrice: decimal }),
);

// 시세를 한 곳에서 받아 종목별 스냅샷으로 들고 있어요(ADR-0007, docs/architecture/engine.md 시세 스냅샷).
// 봇은 snapshot()만 읽고 토스를 직접 부르지 않아요.
@Injectable()
export class MarketCollectorService {
  // 연결당 구독 100건. 종목 하나에 체결·호가 2건이에요
  private static readonly MAX_SUBSCRIBED_SYMBOLS = 50;
  // 이보다 오래 수신이 없으면 REST로 보정해요 (처음 값 30초)
  private static readonly STALE_MS = 30_000;
  // 보정 확인과 quote_caches 쓰기 주기
  private static readonly TICK_MS = 5000;
  // prices는 한 번에 200종목까지 받아요
  private static readonly MAX_PRICE_SYMBOLS = 200;
  // 보정은 판단용이 아니라 잠깐 기다려도 돼요
  private static readonly CORRECT_WAIT_MS = 1000;

  private readonly logger = new Logger(MarketCollectorService.name);
  private readonly snapshots = new Map<string, MarketSnapshot>();
  // 보정도 실패한 종목(feed_stale). 시세가 다시 들어오면 빠져요
  private readonly stale = new Set<string>();
  private held = new Set<string>();
  private watched: string[] = [];
  private orderStream: OrderStreamHandlers | undefined;
  private timer: NodeJS.Timeout | undefined;
  private isTicking = false;

  constructor(
    private readonly socket: TossSocket,
    private readonly toss: TossClient,
    private readonly quotes: QuoteCacheRepository,
  ) {}

  // engine 시작 순서 7번. 연결이 늦어져도 기다리지 않아요(그동안은 REST 보정).
  // personal:order는 해석하지 않고 AccountSync에 넘겨요 (docs/architecture/engine.md 시세 스냅샷)
  start(orderStream: OrderStreamHandlers): void {
    this.orderStream = orderStream;
    this.socket.connect({
      onMessage: (topic, data) => {
        this.receive(topic, data);
      },
      onReconnected: () => {
        orderStream.onReconnected();
      },
    });
    this.declare();
    this.timer = setInterval(() => {
      void this.tick();
    }, MarketCollectorService.TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.socket.close();
  }

  // 감시할 종목 전체를 바꿔요. 보유 종목을 먼저 구독하고, 구독 한도를 넘는 종목은 REST 보정으로만 받아요
  watch(held: string[], candidates: string[]): void {
    this.held = new Set(held);
    this.watched = [...new Set([...held, ...candidates])];
    for (const symbol of this.snapshots.keys())
      if (!this.watched.includes(symbol)) this.snapshots.delete(symbol);
    for (const symbol of this.stale)
      if (!this.watched.includes(symbol)) this.stale.delete(symbol);

    this.declare();
  }

  // 시세가 없거나 끊긴(feed_stale) 종목은 undefined예요. 봇은 그 종목 판단을 건너뛰어요
  snapshot(symbol: string): MarketSnapshot | undefined {
    if (this.stale.has(symbol)) return undefined;
    return this.snapshots.get(symbol);
  }

  // engine_statuses의 시세 끊긴 종목
  staleSymbols(): string[] {
    return [...this.stale];
  }

  // 시세 구독 + 주문 이벤트(personal:order, codes에 accountSeq)
  private declare(): void {
    const codes = this.watched.slice(
      0,
      MarketCollectorService.MAX_SUBSCRIBED_SYMBOLS,
    );
    // 개발 점검(PaperBroker)은 실제 계좌 주문 이벤트를 받지 않아요
    const account =
      env.TOSS_ACCOUNT_SEQ && env.BROKER_MODE !== 'paper'
        ? [env.TOSS_ACCOUNT_SEQ]
        : [];
    this.socket.declare([
      { type: 'trade:kr', codes },
      { type: 'orderbook:kr', codes },
      { type: 'personal:order', codes: account },
    ]);
  }

  private receive(topic: string, data: unknown): void {
    // topic: trade:kr:005930, orderbook:kr:005930, personal:order:{accountSeq}
    const [channel, , symbol] = topic.split(':');
    if (channel === 'personal') {
      this.orderStream?.onOrder(data);
      return;
    }
    if (symbol === undefined || !this.watched.includes(symbol)) return;

    if (channel === 'trade') {
      const parsed = tradeSchema.safeParse(data);
      if (!parsed.success) return this.warnShape(topic);
      this.update(symbol, parsed.data);
    } else if (channel === 'orderbook') {
      const parsed = orderbookSchema.safeParse(data);
      if (!parsed.success) return this.warnShape(topic);
      this.update(symbol, parsed.data);
    }
  }

  private update(symbol: string, values: Partial<MarketSnapshot>): void {
    const current = this.snapshots.get(symbol) ?? {
      asks: [],
      bids: [],
      receivedAt: 0,
    };
    this.snapshots.set(symbol, {
      ...current,
      ...values,
      receivedAt: Date.now(),
    });
    this.stale.delete(symbol);
  }

  private warnShape(topic: string): void {
    this.logger.warn(`모양이 다른 시세 프레임: ${topic}`);
  }

  // 보정과 화면용 쓰기는 실패해도 매매를 멈추지 않아요
  private async tick(): Promise<void> {
    if (this.isTicking) return;
    this.isTicking = true;
    try {
      await this.correctStale();
      await this.writeQuotes();
    } catch (error) {
      this.logger.warn(`시세 주기 작업 실패: ${String(error)}`);
    } finally {
      this.isTicking = false;
    }
  }

  // 오래된 종목을 prices REST 한 번으로 보정해요. 보정도 실패하면 feed_stale로 막아요
  private async correctStale(): Promise<void> {
    const before = Date.now() - MarketCollectorService.STALE_MS;
    // ponytail: 한 주기에 200종목까지. 감시 종목이 그보다 많아지면 나눠 불러요
    const lagging = this.watched
      .filter(
        (symbol) => (this.snapshots.get(symbol)?.receivedAt ?? 0) < before,
      )
      .slice(0, MarketCollectorService.MAX_PRICE_SYMBOLS);
    if (lagging.length === 0) return;

    let prices: z.infer<typeof pricesSchema>;
    try {
      prices = await this.toss.request({
        group: 'MARKET_DATA',
        path: '/api/v1/prices',
        query: { symbols: lagging.join(',') },
        waitMs: MarketCollectorService.CORRECT_WAIT_MS,
        result: pricesSchema,
      });
    } catch (error) {
      for (const symbol of lagging) this.stale.add(symbol);
      this.logger.warn(
        `시세 보정 실패, ${lagging.length}종목 feed_stale: ${String(error)}`,
      );
      return;
    }

    const corrected = new Set<string>();
    for (const { symbol, lastPrice } of prices) {
      if (!lagging.includes(symbol)) continue;
      this.update(symbol, { price: lastPrice });
      corrected.add(symbol);
    }
    for (const symbol of lagging)
      if (!corrected.has(symbol)) this.stale.add(symbol);
  }

  // 화면용 보유 종목 최근가(quote_caches)
  private async writeQuotes(): Promise<void> {
    const rows = [...this.held].flatMap((symbol) => {
      const snapshot = this.snapshots.get(symbol);
      if (snapshot?.price === undefined) return [];
      return [
        {
          symbol,
          price: snapshot.price,
          receivedAt: new Date(snapshot.receivedAt),
        },
      ];
    });
    await this.quotes.upsert(rows);
  }
}
