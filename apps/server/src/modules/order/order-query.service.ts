import { Injectable } from '@nestjs/common';

import { OrderRepository } from './order.repository.js';

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
}
