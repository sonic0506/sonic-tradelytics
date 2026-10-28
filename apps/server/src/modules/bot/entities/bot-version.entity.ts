import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';
import { numericTransformer } from '@/common/database/numeric.transformer.js';

import {
  AMOUNT_TYPES,
  type AmountType,
  HOLDING_ACTIONS,
  type HoldingAction,
  VERSION_CHANGE_KINDS,
  type VersionChangeKind,
} from '../bot.constants.js';
import { Bot } from './bot.entity.js';

// 규칙이 바뀔 때마다 한 행씩 추가해요 (FR-BOT-03).
@Entity('bot_versions')
@Unique(['botId', 'version'])
@Check(oneOf('change_kind', VERSION_CHANGE_KINDS))
@Check(oneOf('order_size_type', AMOUNT_TYPES))
@Check(oneOf('on_daily_limit', HOLDING_ACTIONS))
@Check(`"order_size_value" > 0`)
@Check(`"split_count" >= 1`)
@Check(`"max_positions" >= 1`)
@Check(`"daily_loss_pct" > 0`)
@Check(`"total_loss_pct" > 0`)
export class BotVersion {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('bigint')
  botId: number;

  @ManyToOne(() => Bot, { nullable: false })
  @JoinColumn()
  bot: Bot;

  @Column('integer')
  version: number;

  @Column('text')
  changeKind: VersionChangeKind;

  // 유형별 종목 필터·진입·청산 값. 저장 전에 코드에서 모양을 검증해요
  @Column('jsonb')
  params: Record<string, unknown>;

  @Column('text')
  orderSizeType: AmountType;

  // 정률이면 0~1, 정액이면 원
  @Column('numeric', {
    precision: 18,
    scale: 4,
    transformer: numericTransformer,
  })
  orderSizeValue: number;

  @Column('integer')
  splitCount: number;

  @Column('integer')
  maxPositions: number;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  dailyLossPct: number;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  totalLossPct: number;

  @Column('integer', { default: 3 })
  stopStreak: number;

  @Column('text')
  onDailyLimit: HoldingAction;

  // null이면 적용 대기. 보유 종목이 없을 때 적용돼요
  @Column('timestamptz', { nullable: true })
  appliedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
