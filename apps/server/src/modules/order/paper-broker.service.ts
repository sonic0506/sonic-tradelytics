import { Injectable, Logger } from '@nestjs/common';

import { kstDate } from '@/common/time/kst-date.js';
import {
  MarketCalendarService,
  MarketCollectorService,
} from '@/modules/market-data/index.js';

import { FeeScheduleMissingException } from './order.exception.js';
import { OrderRepository } from './order.repository.js';
import type { OrderReport } from './order.types.js';
import {
  type FeeRates,
  isStopTriggered,
  paperCosts,
  paperFillPrice,
} from './paper.rule.js';
import type {
  BrokerOrderSummary,
  PlaceOrder,
  PlaceResult,
  PlaceStop,
  StopResult,
} from './toss-broker.service.js';

interface PaperOrder extends Omit<PlaceOrder, 'clientOrderId'> {
  brokerOrderId: string;
  orderedAt: Date;
}

interface PaperStop {
  conditionalOrderId: string;
  symbol: string;
  quantity: number;
  triggerPrice: number;
  expireDate: string;
  triggeredOrderId: string | null;
}

// 개발 점검용 모의 체결 (ADR-0005, 로드맵 M3). TossBrokerService와 같은 메서드라 OrderService가 바꿔 끼워요.
// 실시간 시세(MarketCollector)로 1초마다 맞춰 보고, 결과는 personal:order처럼 onReport로 넘겨요.
// ponytail: 전량 한 번에 체결해요(호가 잔량·부분 체결 없음). 상·하한가 거부와 점검용 투자금 상한은 아직 없어요
@Injectable()
export class PaperBrokerService {
  private static readonly MATCH_MS = 1000;

  private readonly logger = new Logger(PaperBrokerService.name);
  private readonly open = new Map<string, PaperOrder>();
  private readonly closed = new Map<string, PaperOrder>();
  private readonly stops = new Map<string, PaperStop>();
  // 아직 넘기지 못한 주문 결과. 넘기다 실패하면 다음 주기에 이어서 넘겨요
  private readonly outbox: OrderReport[] = [];
  private onReport: (report: OrderReport) => Promise<unknown> = () =>
    Promise.resolve();
  private rates: FeeRates = { commissionRate: 0, taxRate: 0 };
  private timer: NodeJS.Timeout | undefined;
  private isMatching = false;
  private wasSession = false;

  constructor(
    private readonly orders: OrderRepository,
    private readonly market: MarketCollectorService,
    private readonly calendar: MarketCalendarService,
  ) {}

  // 수수료율을 읽고, 재시작 전에 걸어 둔 미체결 주문과 손절을 다시 맡아요. 오늘 것이 아닌 주문은 취소해요
  async start(
    onReport: (report: OrderReport) => Promise<unknown>,
  ): Promise<void> {
    const today = kstDate();
    const rates = await this.orders.findFeeSchedule(today);
    if (!rates) throw new FeeScheduleMissingException(today);
    this.rates = rates;
    this.onReport = onReport;

    const [orders, stops] = await Promise.all([
      this.orders.findOpenBotOrders(),
      this.orders.findWatchingProtectives(),
    ]);
    for (const order of orders) {
      if (order.brokerOrderId === null) continue;
      const adopted: PaperOrder = {
        brokerOrderId: order.brokerOrderId,
        symbol: order.symbol,
        side: order.side,
        orderType: order.orderType,
        price: order.price,
        quantity: order.quantity - order.filledQuantity,
        orderedAt: order.createdAt,
      };
      if (kstDate(order.createdAt) === today)
        this.open.set(adopted.brokerOrderId, adopted);
      else this.close(adopted, 'CANCELED');
    }
    for (const stop of stops)
      if (stop.brokerConditionalOrderId !== null)
        this.stops.set(stop.brokerConditionalOrderId, {
          conditionalOrderId: stop.brokerConditionalOrderId,
          symbol: stop.position.symbol,
          quantity: stop.quantity,
          triggerPrice: stop.triggerPrice,
          expireDate: stop.expireDate,
          triggeredOrderId: null,
        });
    this.logger.log(
      `모의 체결 시작: 미체결 ${this.open.size}건, 손절 ${this.stops.size}건`,
    );
    this.timer = setInterval(() => {
      void this.match();
    }, PaperBrokerService.MATCH_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  // 같은 판단(clientOrderId)은 같은 주문이에요. 같은 종목 반대 방향 미체결이 있으면 토스처럼 거부해요
  place(order: PlaceOrder): Promise<PlaceResult> {
    const brokerOrderId = `paper-${order.clientOrderId}`;
    if (this.open.has(brokerOrderId) || this.closed.has(brokerOrderId))
      return Promise.resolve({ outcome: 'accepted', brokerOrderId });
    const isOpposite = [...this.open.values()].some(
      ({ symbol, side }) => symbol === order.symbol && side !== order.side,
    );
    if (isOpposite)
      return Promise.resolve({
        outcome: 'rejected',
        code: 'opposite-pending-order-exists',
      });
    this.open.set(brokerOrderId, {
      brokerOrderId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      price: order.price,
      quantity: order.quantity,
      orderedAt: new Date(),
    });
    return Promise.resolve({ outcome: 'accepted', brokerOrderId });
  }

  // 결과(CANCELED)는 토스처럼 나중에 와요
  cancel(brokerOrderId: string): Promise<boolean> {
    const order = this.open.get(brokerOrderId);
    if (order) this.close(order, 'CANCELED');
    return Promise.resolve(order !== undefined);
  }

  placeStop(stop: PlaceStop): Promise<StopResult> {
    const conditionalOrderId = `paper-stop-${stop.clientOrderId}`;
    if (!this.stops.has(conditionalOrderId))
      this.stops.set(conditionalOrderId, {
        conditionalOrderId,
        symbol: stop.symbol,
        quantity: stop.quantity,
        triggerPrice: stop.triggerPrice,
        expireDate: stop.expireDate,
        triggeredOrderId: null,
      });
    return Promise.resolve({ outcome: 'accepted', conditionalOrderId });
  }

  // 이미 발동됐거나 없으면 false
  cancelStop(conditionalOrderId: string): Promise<boolean> {
    const stop = this.stops.get(conditionalOrderId);
    if (!stop || stop.triggeredOrderId !== null) return Promise.resolve(false);
    this.stops.delete(conditionalOrderId);
    return Promise.resolve(true);
  }

  stopState(
    conditionalOrderId: string,
  ): Promise<{ isTriggered: boolean; triggeredOrderId: string | null }> {
    const triggeredOrderId =
      this.stops.get(conditionalOrderId)?.triggeredOrderId ?? null;
    return Promise.resolve({
      isTriggered: triggeredOrderId !== null,
      triggeredOrderId,
    });
  }

  listOrders(symbol: string, from: string): Promise<BrokerOrderSummary[]> {
    return Promise.resolve(
      [...this.open.values(), ...this.closed.values()]
        .filter(
          (order) =>
            order.symbol === symbol && kstDate(order.orderedAt) >= from,
        )
        .map(({ brokerOrderId, side, quantity, price, orderedAt }) => ({
          brokerOrderId,
          symbol,
          side,
          quantity,
          price,
          orderedAt,
        })),
    );
  }

  // 정규장에서만 발동·체결해요. 정규장이 끝나면 DAY 주문을 취소하고 만료된 손절을 지워요
  async match(): Promise<void> {
    if (this.isMatching) return;
    this.isMatching = true;
    try {
      const isSession = this.calendar.isRegularSession();
      if (isSession) {
        this.trigger();
        this.fill();
      } else if (this.wasSession) this.expire();
      this.wasSession = isSession;
      await this.flush();
    } catch (error) {
      this.logger.error(`모의 체결 반영 실패: ${String(error)}`);
    } finally {
      this.isMatching = false;
    }
  }

  // 발동하면 시장가 매도를 내요. 발동 주문 id는 stopState로 알려 줘요
  private trigger(): void {
    for (const stop of this.stops.values()) {
      if (stop.triggeredOrderId !== null) continue;
      const lastPrice = this.market.snapshot(stop.symbol)?.price;
      if (!isStopTriggered(stop.triggerPrice, lastPrice)) continue;
      stop.triggeredOrderId = `paper-trigger-${stop.conditionalOrderId}`;
      this.open.set(stop.triggeredOrderId, {
        brokerOrderId: stop.triggeredOrderId,
        symbol: stop.symbol,
        side: 'SELL',
        orderType: 'MARKET',
        price: null,
        quantity: stop.quantity,
        orderedAt: new Date(),
      });
    }
  }

  private fill(): void {
    for (const order of this.open.values()) {
      const snapshot = this.market.snapshot(order.symbol);
      if (!snapshot) continue;
      const price = paperFillPrice(order, {
        bestAsk: snapshot.asks[0]?.price ?? null,
        bestBid: snapshot.bids[0]?.price ?? null,
        lastPrice: snapshot.price ?? null,
      });
      if (price !== null) this.close(order, 'FILLED', price);
    }
  }

  private expire(): void {
    for (const order of this.open.values()) this.close(order, 'CANCELED');
    const today = kstDate();
    for (const [id, stop] of this.stops)
      if (stop.triggeredOrderId === null && stop.expireDate <= today)
        this.stops.delete(id);
  }

  private close(
    order: PaperOrder,
    status: 'FILLED' | 'CANCELED',
    fillPrice?: number,
  ): void {
    this.open.delete(order.brokerOrderId);
    this.closed.set(order.brokerOrderId, order);
    const at = new Date();
    const amount = fillPrice === undefined ? null : fillPrice * order.quantity;
    const costs =
      amount === null ? null : paperCosts(order.side, amount, this.rates);
    this.outbox.push({
      brokerOrderId: order.brokerOrderId,
      symbol: order.symbol,
      side: order.side,
      orderType: order.orderType,
      timeInForce: 'DAY',
      status,
      price: order.price,
      quantity: order.quantity,
      filledQuantity: amount === null ? 0 : order.quantity,
      avgFilledPrice: fillPrice ?? null,
      filledAmount: amount,
      commission: costs?.commission ?? null,
      tax: costs?.tax ?? null,
      orderedAt: order.orderedAt,
      canceledAt: status === 'CANCELED' ? at : null,
      filledAt: amount === null ? null : at,
      settlementDate: null,
      raw: { paper: true },
    });
  }

  // 한 건씩 차례로 넘겨요. 실패하면 남은 것은 다음 주기에 넘겨요
  private async flush(): Promise<void> {
    const [report] = this.outbox;
    if (!report) return;
    await this.onReport(report);
    this.outbox.shift();
    await this.flush();
  }
}
