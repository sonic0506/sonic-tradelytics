import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';

import {
  ORDER_EVENT_SOURCES,
  type OrderEventSource,
} from '../order.constants.js';
import { BrokerOrder } from './broker-order.entity.js';

// 주문 상태·체결 변화의 이력 (웹소켓 personal:order + REST 재동기화). 추가만 해요.
@Entity('order_events')
@Index(['orderId', 'occurredAt'])
@Check(oneOf('source', ORDER_EVENT_SOURCES))
export class OrderEvent {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('bigint')
  orderId: number;

  @ManyToOne(() => BrokerOrder, { nullable: false })
  @JoinColumn()
  order: BrokerOrder;

  @Column('text')
  source: OrderEventSource;

  // 이벤트 시점의 토스 주문 상태
  @Column('text')
  status: string;

  @Column('integer', { default: 0 })
  filledQuantityDelta: number;

  // 건별 체결가 (웹소켓에만 있음)
  @Column('bigint', { nullable: true })
  fillPrice: number | null;

  @Column('timestamptz')
  occurredAt: Date;

  // 원본 메시지
  @Column('jsonb')
  raw: Record<string, unknown>;

  // 받은 시각
  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
