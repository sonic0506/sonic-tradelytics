import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { IsNull, LessThanOrEqual, type Repository } from 'typeorm';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import type { OrderSide } from './order.constants.js';

export type BrokerOrderFields = Omit<
  BrokerOrder,
  'id' | 'decision' | 'position' | 'createdAt' | 'updatedAt'
>;

export type OrderEventFields = Pick<
  OrderEvent,
  | 'orderId'
  | 'source'
  | 'status'
  | 'filledQuantityDelta'
  | 'fillPrice'
  | 'occurredAt'
  | 'raw'
>;

@Injectable()
export class OrderRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get orders(): Repository<BrokerOrder> {
    return this.txHost.tx.getRepository(BrokerOrder);
  }

  private get events(): Repository<OrderEvent> {
    return this.txHost.tx.getRepository(OrderEvent);
  }

  private get protectives(): Repository<ProtectiveOrder> {
    return this.txHost.tx.getRepository(ProtectiveOrder);
  }

  findByBrokerOrderId(brokerOrderId: string): Promise<BrokerOrder | null> {
    return this.orders.findOneBy({ brokerOrderId });
  }

  // 이 토스 주문을 낸 손절 조건주문
  findProtectiveByTriggeredOrderId(
    triggeredOrderId: string,
  ): Promise<ProtectiveOrder | null> {
    return this.protectives.findOneBy({ triggeredOrderId });
  }

  // 응답을 못 받은 봇 주문 후보: 같은 종목·방향·수량·가격이고 그 주문보다 먼저 저장된 requested 주문
  async hasLostCandidate(candidate: {
    symbol: string;
    side: OrderSide;
    quantity: number;
    price: number | null;
    orderedAt: Date;
  }): Promise<boolean> {
    const found = await this.orders.findOne({
      select: { id: true },
      where: {
        status: 'requested',
        brokerOrderId: IsNull(),
        symbol: candidate.symbol,
        side: candidate.side,
        quantity: candidate.quantity,
        price: candidate.price ?? IsNull(),
        createdAt: LessThanOrEqual(candidate.orderedAt),
      },
    });
    return found !== null;
  }

  create(fields: BrokerOrderFields): Promise<BrokerOrder> {
    return this.orders.save(this.orders.create(fields));
  }

  async update(
    id: number,
    fields: Partial<Omit<BrokerOrderFields, 'origin' | 'decisionId'>>,
  ): Promise<void> {
    await this.orders.update({ id }, fields);
  }

  async addEvent(fields: OrderEventFields): Promise<void> {
    await this.events.save(this.events.create(fields));
  }
}
