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
import { Bot } from '@/modules/bot/index.js';

import {
  EXIT_REASONS,
  type ExitReason,
  POSITION_STATUSES,
  type PositionStatus,
} from '../position.constants.js';

// 거래 1줄 (FR-PERF-04). bot_id가 null이면 직접 거래예요 (F4).
@Entity('positions')
@Index(['botId', 'status'])
@Index(['botId', 'closedAt'])
@Index(['symbol'], { where: `"status" = 'open'` })
@Check(oneOf('status', POSITION_STATUSES))
@Check(oneOf('exit_reason', EXIT_REASONS))
@Check(`"quantity" >= 0`)
@Check(`("status" = 'closed') = ("closed_at" IS NOT NULL)`)
@Check(`"status" = 'open' OR "quantity" = 0`)
export class Position {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('bigint', { nullable: true })
  botId: number | null;

  @ManyToOne(() => Bot)
  @JoinColumn()
  bot: Bot | null;

  @Column('text')
  symbol: string;

  @Column('text')
  status: PositionStatus;

  // 봇 몫 보유 수량 (FR-MAN-02)
  @Column('integer')
  quantity: number;

  // 보유분 매수 금액 (POL-FUND-05)
  @Column('bigint', { default: 0 })
  costBasis: number;

  // 수수료·세금 차감 후 (NFR-05)
  @Column('bigint', { default: 0 })
  realizedPnl: number;

  @Column('bigint', { default: 0 })
  totalFees: number;

  @Column('bigint', { nullable: true })
  highPrice: number | null;

  @Column('bigint', { nullable: true })
  lowPrice: number | null;

  @Column('timestamptz')
  openedAt: Date;

  @Column('timestamptz', { nullable: true })
  closedAt: Date | null;

  @Column('text', { nullable: true })
  exitReason: ExitReason | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
