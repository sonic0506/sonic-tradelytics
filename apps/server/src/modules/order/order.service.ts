import { Injectable, Logger } from '@nestjs/common';
import { Transactional } from '@nestjs-cls/transactional';

import { PositionService } from '@/modules/position/index.js';

import type { BrokerOrder } from './entities/broker-order.entity.js';
import {
  OPEN_ORDER_STATUSES,
  type OrderEventSource,
} from './order.constants.js';
import { OrderRepository } from './order.repository.js';
import type { ApplyResult, OrderReport } from './order.types.js';

const OPEN_STATUSES: readonly string[] = OPEN_ORDER_STATUSES;

// 봇 하나의 미체결 주문 (POL-FUND-05, 12)
export interface BotOpenOrders {
  // 미체결 매수 주문 금액 = 남은 수량 × 지정가
  openBuyAmount: number;
  hasOpenOrders: boolean;
}

type Filled = Pick<
  BrokerOrder,
  'filledQuantity' | 'filledAmount' | 'commission' | 'tax'
>;
const NOTHING_FILLED: Filled = {
  filledQuantity: 0,
  filledAmount: null,
  commission: null,
  tax: null,
};

// 토스 주문 상태를 broker_orders에 맞춰요 (docs/architecture/order-lifecycle.md 재동기화).
// 주문 생성·취소와 손절 조건주문은 BotRunner를 만들 때 여기에 더해요.
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly positions: PositionService,
  ) {}

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

  // 토스가 알려 준 주문 1건을 반영해요. 같은 값을 여러 번 받아도 결과가 같아요
  @Transactional()
  async applyReport(
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    // 취소 거부는 토스가 따로 만드는 레코드예요. 원주문은 이전 상태로 돌아가서 원주문만 따라가요
    if (report.status === 'CANCEL_REJECTED') return 'ignored';

    const known = await this.orders.findByBrokerOrderId(report.brokerOrderId);
    if (known) return this.update(known, report, source);
    return this.classify(report, source);
  }

  private async update(
    order: BrokerOrder,
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    const syncedAt = source === 'rest' ? new Date() : order.syncedAt;
    // 늦게 온 옛 값(체결이 줄거나, 끝난 주문이 다시 미체결)은 반영하지 않아요
    const isStale =
      report.filledQuantity < order.filledQuantity ||
      (!OPEN_STATUSES.includes(order.status) &&
        OPEN_STATUSES.includes(report.status));
    if (isStale) return 'unchanged';
    if (
      report.filledQuantity === order.filledQuantity &&
      report.status === order.status
    ) {
      if (source === 'rest') await this.orders.update(order.id, { syncedAt });
      return 'unchanged';
    }

    await this.orders.update(order.id, {
      status: report.status,
      filledQuantity: report.filledQuantity,
      avgFilledPrice: report.avgFilledPrice,
      filledAmount: report.filledAmount,
      commission: report.commission,
      tax: report.tax,
      orderedAt: report.orderedAt,
      // 웹소켓 이벤트에는 체결 시각이 없어요
      filledAt: report.filledAt ?? order.filledAt,
      canceledAt: report.canceledAt,
      settlementDate: report.settlementDate,
      syncedAt,
    });
    await this.record(order.id, order.positionId, order, report, source);
    return 'updated';
  }

  // 모르는 주문: 손절 발동 주문 → 응답을 못 받은 봇 주문 후보 → 직접 거래 순서로 봐요 (FR-MAN-01)
  private async classify(
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<ApplyResult> {
    const protective = await this.orders.findProtectiveByTriggeredOrderId(
      report.brokerOrderId,
    );
    if (!protective && (await this.orders.hasLostCandidate(report))) {
      this.logger.warn(
        `응답을 못 받은 봇 주문일 수 있어 분류하지 않았어요: ${report.symbol} ${report.side} ${report.quantity}주`,
      );
      return 'pending_recovery';
    }

    const positionId =
      protective?.positionId ??
      (await this.positions.openManual(report.symbol, report.orderedAt)).id;
    const created = await this.orders.create({
      origin: protective ? 'protective' : 'manual',
      decisionId: null,
      positionId,
      brokerOrderId: report.brokerOrderId,
      symbol: report.symbol,
      side: report.side,
      orderType: report.orderType,
      timeInForce: report.timeInForce,
      price: report.price,
      quantity: report.quantity,
      status: report.status,
      rejectCode: null,
      filledQuantity: report.filledQuantity,
      avgFilledPrice: report.avgFilledPrice,
      filledAmount: report.filledAmount,
      commission: report.commission,
      tax: report.tax,
      orderedAt: report.orderedAt,
      filledAt: report.filledAt,
      canceledAt: report.canceledAt,
      settlementDate: report.settlementDate,
      syncedAt: source === 'rest' ? new Date() : null,
    });
    await this.record(created.id, positionId, NOTHING_FILLED, report, source);
    return 'created';
  }

  // 상태 변화 이력을 남기고, 체결이 늘었으면 포지션에 반영해요
  private async record(
    orderId: number,
    positionId: number,
    before: Filled,
    report: OrderReport,
    source: OrderEventSource,
  ): Promise<void> {
    const quantity = report.filledQuantity - before.filledQuantity;
    const amount = (report.filledAmount ?? 0) - (before.filledAmount ?? 0);
    const fees =
      (report.commission ?? 0) +
      (report.tax ?? 0) -
      (before.commission ?? 0) -
      (before.tax ?? 0);
    const occurredAt = report.filledAt ?? report.canceledAt ?? new Date();

    await this.orders.addEvent({
      orderId,
      source,
      status: report.status,
      filledQuantityDelta: quantity,
      // 이번에 늘어난 체결분의 평균가
      fillPrice: quantity > 0 ? Math.round(amount / quantity) : null,
      occurredAt,
      raw: report.raw,
    });
    if (quantity > 0)
      await this.positions.applyFill(positionId, {
        side: report.side,
        quantity,
        amount,
        fees,
        at: occurredAt,
      });
  }
}
