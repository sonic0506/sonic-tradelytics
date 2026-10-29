import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { In, IsNull, LessThanOrEqual, type Repository } from 'typeorm';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import {
  LIVE_PROTECTIVE_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  type OrderSide,
} from './order.constants.js';

export type ProtectiveFields = Omit<
  ProtectiveOrder,
  'id' | 'position' | 'createdAt' | 'updatedAt'
>;

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
  // 봇들의 미체결 주문은 많아야 수십 건이에요
  private static readonly MAX_OPEN_ORDERS = 1000;

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

  // 봇들의 미체결 주문 (POL-FUND-05, 12). 포지션으로 봇을 알아요
  findOpenForBots(botIds: number[]): Promise<BrokerOrder[]> {
    return this.orders.find({
      relations: { position: true },
      where: {
        status: In([...OPEN_ORDER_STATUSES]),
        position: { botId: In(botIds) },
      },
      take: OrderRepository.MAX_OPEN_ORDERS,
    });
  }

  // 응답을 못 받은 주문 (status requested, broker_order_id 없음)
  findRequested(): Promise<BrokerOrder[]> {
    return this.orders.find({
      relations: { position: true },
      where: { status: 'requested', brokerOrderId: IsNull() },
      order: { createdAt: 'ASC' },
      take: OrderRepository.MAX_OPEN_ORDERS,
    });
  }

  // 이미 어떤 broker_orders에 연결된 토스 주문 id
  async linkedBrokerOrderIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const linked = await this.orders.find({
      select: { id: true, brokerOrderId: true },
      where: { brokerOrderId: In(ids) },
      take: ids.length,
    });
    return new Set(linked.flatMap(({ brokerOrderId }) => brokerOrderId ?? []));
  }

  findByBrokerOrderId(brokerOrderId: string): Promise<BrokerOrder | null> {
    return this.orders.findOneBy({ brokerOrderId });
  }

  findLiveProtective(positionId: number): Promise<ProtectiveOrder | null> {
    return this.protectives.findOneBy({
      positionId,
      status: In([...LIVE_PROTECTIVE_ORDER_STATUSES]),
    });
  }

  // 발동 주문 id를 아직 모를 때: 같은 종목·수량으로 걸려 있는 살아 있는 손절
  findLiveProtectiveFor(
    symbol: string,
    quantity: number,
  ): Promise<ProtectiveOrder | null> {
    return this.protectives.findOne({
      relations: { position: true },
      where: {
        quantity,
        status: In([...LIVE_PROTECTIVE_ORDER_STATUSES]),
        position: { symbol, status: 'open' },
      },
    });
  }

  addProtective(fields: ProtectiveFields): Promise<ProtectiveOrder> {
    return this.protectives.save(this.protectives.create(fields));
  }

  async updateProtective(
    id: number,
    fields: Partial<ProtectiveFields>,
  ): Promise<void> {
    await this.protectives.update({ id }, fields);
  }

  async hasOpenOrders(positionId: number): Promise<boolean> {
    const open = await this.orders.findOne({
      select: { id: true },
      where: { positionId, status: In([...OPEN_ORDER_STATUSES]) },
    });
    return open !== null;
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
