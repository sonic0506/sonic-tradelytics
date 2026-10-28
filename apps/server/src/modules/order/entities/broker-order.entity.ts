import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';
import { numericTransformer } from '@/common/database/numeric.transformer.js';
import { Decision } from '@/modules/decision/index.js';
import { Position } from '@/modules/position/index.js';

import {
  OPEN_ORDER_STATUSES,
  ORDER_ORIGINS,
  ORDER_SIDES,
  ORDER_TYPES,
  type OrderOrigin,
  type OrderSide,
  type OrderType,
  TIME_IN_FORCES,
  type TimeInForce,
} from '../order.constants.js';

// 토스 주문 1건 = 1행. 상태와 체결 합계는 최신값으로 갱신해요.
@Entity('broker_orders')
@Index(['positionId'])
// 미체결 조회 (POL-FUND-05, POL-RISK-16)
@Index(['symbol'], { where: oneOf('status', OPEN_ORDER_STATUSES) })
@Check(oneOf('origin', ORDER_ORIGINS))
@Check(oneOf('side', ORDER_SIDES))
@Check(oneOf('order_type', ORDER_TYPES))
@Check(oneOf('time_in_force', TIME_IN_FORCES))
@Check(`"quantity" > 0`)
@Check(`("origin" = 'bot') = ("decision_id" IS NOT NULL)`)
@Check(
  `"status" IN ('requested', 'request_failed') OR "broker_order_id" IS NOT NULL`,
)
@Check(`("status" = 'request_failed') = ("reject_code" IS NOT NULL)`)
export class BrokerOrder {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('text')
  origin: OrderOrigin;

  // 봇 주문만. decision 1개 = 주문 1개 (Q-019)
  @Column('uuid', { nullable: true })
  decisionId: string | null;

  @OneToOne(() => Decision)
  @JoinColumn()
  decision: Decision | null;

  @Column('bigint')
  positionId: number;

  @ManyToOne(() => Position, { nullable: false })
  @JoinColumn()
  position: Position;

  // 토스 orderId. 주문 응답을 받기 전에는 null
  @Column('text', { nullable: true, unique: true })
  brokerOrderId: string | null;

  @Column('text')
  symbol: string;

  @Column('text')
  side: OrderSide;

  @Column('text')
  orderType: OrderType;

  @Column('text')
  timeInForce: TimeInForce;

  // 지정가. 시장가는 null
  @Column('bigint', { nullable: true })
  price: number | null;

  @Column('integer')
  quantity: number;

  @Column('text')
  status: string;

  // request_failed일 때 토스 에러 코드 (예: insufficient-buying-power, not_found)
  @Column('text', { nullable: true })
  rejectCode: string | null;

  @Column('integer', { default: 0 })
  filledQuantity: number;

  @Column('numeric', {
    precision: 18,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  avgFilledPrice: number | null;

  @Column('bigint', { nullable: true })
  filledAmount: number | null;

  @Column('bigint', { nullable: true })
  commission: number | null;

  @Column('bigint', { nullable: true })
  tax: number | null;

  @Column('timestamptz', { nullable: true })
  orderedAt: Date | null;

  @Column('timestamptz', { nullable: true })
  filledAt: Date | null;

  @Column('timestamptz', { nullable: true })
  canceledAt: Date | null;

  @Column('date', { nullable: true })
  settlementDate: string | null;

  // 마지막으로 REST 주문 조회와 맞춘 시각
  @Column('timestamptz', { nullable: true })
  syncedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
