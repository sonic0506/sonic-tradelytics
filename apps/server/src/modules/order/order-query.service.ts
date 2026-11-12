import { Injectable } from '@nestjs/common';

import { kstAt, kstDate, kstRange } from '@/common/time/kst-date.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import { DEFAULT_LIST_ORIGINS, type OrderOrigin } from './order.constants.js';
import { OrderRepository } from './order.repository.js';

// 포지션 하나의 체결 합계 (투자 내역). 금액은 체결 금액, 비용은 수수료·세금
export interface FillTotals {
  buyQuantity: number;
  buyAmount: number;
  sellQuantity: number;
  sellAmount: number;
  commission: number;
  tax: number;
}

// 오늘 체결 수 (홈). 봇마다 수는 봇 카드에 써요
export interface TodayFills {
  total: number;
  buy: number;
  sell: number;
  byBot: Map<number, number>;
}

// ponytail: 하루 체결 수가 적어 한 번에 읽어 세요. 많아지면 GROUP BY 쿼리로 바꿔요
const MAX_TODAY_FILLS = 10_000;

// 봇 하나의 미체결 주문 (POL-FUND-05, 12)
export interface BotOpenOrders {
  // 미체결 매수 주문 금액 = 남은 수량 × 지정가
  openBuyAmount: number;
  hasOpenOrders: boolean;
}

// 주문 읽기만 해요. 토스(TossClient)가 필요 없어 api 프로세스도 가져와요
@Injectable()
export class OrderQueryService {
  constructor(private readonly orders: OrderRepository) {}

  // ponytail: 시장가 매수는 가격을 몰라 0원으로 봐요. 봇은 지정가로 사고, 시장가는 손절·청산 매도에만 써요
  async openOrdersByBot(botIds: number[]): Promise<Map<number, BotOpenOrders>> {
    const result = new Map<number, BotOpenOrders>(
      botIds.map((botId) => [
        botId,
        { openBuyAmount: 0, hasOpenOrders: false },
      ]),
    );
    if (botIds.length === 0) return result;
    for (const order of await this.orders.findOpenForBots(botIds)) {
      const open =
        order.position.botId === null
          ? undefined
          : result.get(order.position.botId);
      if (!open) continue;
      open.hasOpenOrders = true;
      if (order.side === 'BUY')
        open.openBuyAmount +=
          (order.quantity - order.filledQuantity) * (order.price ?? 0);
    }
    return result;
  }

  // 체결된 주문 목록 (api.md GET /v1/orders). 출처를 정하지 않으면 직접 거래(manual)를 빼요
  findFilledPage(query: {
    from?: string;
    to?: string;
    botIds?: string[];
    origins?: OrderOrigin[];
    skip: number;
    size: number;
  }): Promise<[BrokerOrder[], number]> {
    return this.orders.findFilledPage(
      {
        ...kstRange(query.from, query.to),
        botIds: query.botIds?.map(Number),
        origins: query.origins ?? [...DEFAULT_LIST_ORIGINS],
      },
      query.skip,
      query.size,
    );
  }

  // 오늘(KST) 체결된 주문 수. 직접 거래도 세요
  async todayFills(now: Date): Promise<TodayFills> {
    const [orders] = await this.orders.findFilledPage(
      { start: kstAt(kstDate(now), '00:00') },
      0,
      MAX_TODAY_FILLS,
    );
    const byBot = new Map<number, number>();
    for (const { position } of orders)
      if (position.botId !== null)
        byBot.set(position.botId, (byBot.get(position.botId) ?? 0) + 1);
    const buy = orders.filter(({ side }) => side === 'BUY').length;
    return { total: orders.length, buy, sell: orders.length - buy, byBot };
  }

  // 포지션마다 체결 합계. 체결이 없는 포지션은 빠져요
  async fillTotals(positionIds: number[]): Promise<Map<number, FillTotals>> {
    const result = new Map<number, FillTotals>();
    if (positionIds.length === 0) return result;
    for (const order of await this.orders.findFilledByPositions(positionIds)) {
      const totals = result.get(order.positionId) ?? {
        buyQuantity: 0,
        buyAmount: 0,
        sellQuantity: 0,
        sellAmount: 0,
        commission: 0,
        tax: 0,
      };
      const amount =
        order.filledAmount ??
        Math.round((order.avgFilledPrice ?? 0) * order.filledQuantity);
      if (order.side === 'BUY') {
        totals.buyQuantity += order.filledQuantity;
        totals.buyAmount += amount;
      } else {
        totals.sellQuantity += order.filledQuantity;
        totals.sellAmount += amount;
      }
      totals.commission += order.commission ?? 0;
      totals.tax += order.tax ?? 0;
      result.set(order.positionId, totals);
    }
    return result;
  }

  findByPosition(positionId: number): Promise<BrokerOrder[]> {
    return this.orders.findByPosition(positionId);
  }
}
