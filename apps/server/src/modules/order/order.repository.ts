import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  In,
  IsNull,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Not,
  type Repository,
} from 'typeorm';

import { BrokerOrder } from './entities/broker-order.entity.js';
import { FeeSchedule } from './entities/fee-schedule.entity.js';
import { OrderEvent } from './entities/order-event.entity.js';
import { ProtectiveOrder } from './entities/protective-order.entity.js';
import {
  LIVE_PROTECTIVE_ORDER_STATUSES,
  OPEN_ORDER_STATUSES,
  type OrderOrigin,
  type OrderSide,
} from './order.constants.js';

// 체결 주문 목록 필터 (api.md GET /v1/orders)
export interface FilledOrderFilter {
  start?: Date;
  end?: Date;
  botIds?: number[];
  origins?: OrderOrigin[];
}

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
  // ponytail: 투자 내역 한 페이지(최대 100개 + 보유 중)의 주문을 한 번에 읽어요
  private static readonly MAX_POSITION_ORDERS = 10_000;

  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  private get orders(): Repository<BrokerOrder> {
    return this.txHost.tx.getRepository(BrokerOrder);
  }

  private get events(): Repository<OrderEvent> {
    return this.txHost.tx.getRepository(OrderEvent);
  }

  private get fees(): Repository<FeeSchedule> {
    return this.txHost.tx.getRepository(FeeSchedule);
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

  // 포지션들의 체결된 주문 (투자 내역의 진입·청산가, 비용)
  findFilledByPositions(positionIds: number[]): Promise<BrokerOrder[]> {
    return this.orders.find({
      where: { positionId: In(positionIds), filledQuantity: MoreThan(0) },
      take: OrderRepository.MAX_POSITION_ORDERS,
    });
  }

  // 포지션 하나의 모든 주문, 낸 순서대로 (투자 내역 펼친 줄)
  findByPosition(positionId: number): Promise<BrokerOrder[]> {
    return this.orders.find({
      where: { positionId },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: OrderRepository.MAX_POSITION_ORDERS,
    });
  }

  // 봇 주문 중 미체결이고 토스에 접수된 것 (취소 대상). botId가 없으면 모든 봇
  findOpenBotOrders(botId?: number): Promise<BrokerOrder[]> {
    return this.orders.find({
      relations: { position: true },
      where: {
        status: In([...OPEN_ORDER_STATUSES]),
        brokerOrderId: Not(IsNull()),
        position: { botId: botId ?? Not(IsNull()) },
      },
      take: OrderRepository.MAX_OPEN_ORDERS,
    });
  }

  // 그 날(YYYY-MM-DD)에 적용되는 수수료·세금률 (PaperBroker)
  // 한 주라도 체결된 주문, 마지막 체결 시각 최신순. 포지션과 봇(이름)을 같이 읽어요
  findFilledPage(
    filter: FilledOrderFilter,
    skip: number,
    take: number,
  ): Promise<[BrokerOrder[], number]> {
    const query = this.orders
      .createQueryBuilder('order')
      .innerJoinAndSelect('order.position', 'position')
      .leftJoinAndSelect('position.bot', 'bot')
      .where('order.filledQuantity > 0')
      .andWhere('order.filledAt IS NOT NULL')
      .orderBy('order.filledAt', 'DESC')
      .addOrderBy('order.id', 'DESC');
    if (filter.start)
      query.andWhere('order.filledAt >= :start', { start: filter.start });
    if (filter.end)
      query.andWhere('order.filledAt < :end', { end: filter.end });
    if (filter.botIds?.length)
      query.andWhere('position.botId IN (:...botIds)', {
        botIds: filter.botIds,
      });
    if (filter.origins?.length)
      query.andWhere('order.origin IN (:...origins)', {
        origins: filter.origins,
      });
    return query.skip(skip).take(take).getManyAndCount();
  }

  findFeeSchedule(date: string): Promise<FeeSchedule | null> {
    return this.fees.findOne({
      where: { effectiveFrom: LessThanOrEqual(date) },
      order: { effectiveFrom: 'DESC' },
    });
  }

  // 토스(또는 PaperBroker)에 걸려 있는 손절 조건주문 (PaperBroker 재시작 때 다시 맡아요)
  findWatchingProtectives(): Promise<ProtectiveOrder[]> {
    return this.protectives.find({
      relations: { position: true },
      where: {
        status: In(['open', 'canceling']),
        brokerConditionalOrderId: Not(IsNull()),
      },
      take: OrderRepository.MAX_OPEN_ORDERS,
    });
  }

  // 포지션의 체결된 매도 주문 (평균 청산가 계산)
  findFilledSells(positionId: number): Promise<BrokerOrder[]> {
    return this.orders.find({
      where: { positionId, side: 'SELL', filledQuantity: MoreThan(0) },
      take: OrderRepository.MAX_OPEN_ORDERS,
    });
  }

  // POL-RISK-08: since 이후 봇이 낸 주문 수. botId가 없으면 계좌 전체
  countBotOrdersSince(since: Date, botId?: number): Promise<number> {
    return this.orders.count({
      relations: { position: true },
      where: {
        origin: 'bot',
        createdAt: MoreThanOrEqual(since),
        ...(botId === undefined ? {} : { position: { botId } }),
      },
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

  async linkedConditionalOrderIds(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();
    const linked = await this.protectives.find({
      select: { id: true, brokerConditionalOrderId: true },
      where: { brokerConditionalOrderId: In(ids) },
      take: ids.length,
    });
    return new Set(
      linked.flatMap(
        ({ brokerConditionalOrderId }) => brokerConditionalOrderId ?? [],
      ),
    );
  }

  // 발동된 손절의 주문이 아직 체결 보고로 들어오지 않았을 수 있는 동안
  hasRecentTriggeredProtective(
    positionId: number,
    since: Date,
  ): Promise<boolean> {
    return this.protectives.existsBy({
      positionId,
      status: 'triggered',
      closedAt: MoreThanOrEqual(since),
    });
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
