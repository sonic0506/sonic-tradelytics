import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';
import { Position } from '@/modules/position/index.js';

import {
  LIVE_PROTECTIVE_ORDER_STATUSES,
  PROTECTIVE_ORDER_STATUSES,
  type ProtectiveOrderStatus,
} from '../order.constants.js';

// 손절 조건주문 (POL-RISK-11, 14). 수정하면 토스가 새 id를 주므로 새 행을 추가해요.
@Entity('protective_orders')
// 포지션당 살아 있는 손절은 1개
@Index(['positionId'], {
  unique: true,
  where: oneOf('status', LIVE_PROTECTIVE_ORDER_STATUSES),
})
@Check(oneOf('status', PROTECTIVE_ORDER_STATUSES))
@Check(`"quantity" > 0`)
export class ProtectiveOrder {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('bigint')
  positionId: number;

  @ManyToOne(() => Position, { nullable: false })
  @JoinColumn()
  position: Position;

  // 토스 conditionalOrderId. 응답 전 null
  @Column('text', { nullable: true, unique: true })
  brokerConditionalOrderId: string | null;

  // 조건주문 생성 멱등 키
  @Column('uuid', { unique: true })
  clientOrderId: string;

  @Column('bigint')
  triggerPrice: number;

  // 봇 보유 수량
  @Column('integer')
  quantity: number;

  // 당일 청산 봇은 당일, 이월 봇은 최대 보유일
  @Column('date')
  expireDate: string;

  @Column('text')
  status: ProtectiveOrderStatus;

  // 발동 시 토스 triggeredOrderId
  @Column('text', { nullable: true })
  triggeredOrderId: string | null;

  // 취소·발동·만료 시각
  @Column('timestamptz', { nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
