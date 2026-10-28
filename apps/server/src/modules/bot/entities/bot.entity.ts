import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';
import { numericTransformer } from '@/common/database/numeric.transformer.js';

import {
  AMOUNT_TYPES,
  type AmountType,
  BOT_STAGES,
  BOT_STATUSES,
  BOT_TYPES,
  type BotStage,
  type BotStatus,
  type BotType,
  HOLDING_ACTIONS,
  type HoldingAction,
  RISK_PROFILES,
  type RiskProfile,
} from '../bot.constants.js';

// 봇 하나. 판단에 쓰이는 값은 BotVersion에 있어요.
@Entity('bots')
@Check(oneOf('type', BOT_TYPES))
@Check(oneOf('risk_profile', RISK_PROFILES))
@Check(oneOf('stage', BOT_STAGES))
@Check(oneOf('status', BOT_STATUSES))
@Check(oneOf('budget_type', AMOUNT_TYPES))
@Check(oneOf('on_period_end', HOLDING_ACTIONS))
@Check(`"budget_ratio" > 0 AND "budget_ratio" <= 1`)
@Check(`"budget_amount" > 0`)
@Check(`("budget_type" = 'ratio') = ("budget_ratio" IS NOT NULL)`)
@Check(`("budget_type" = 'fixed') = ("budget_amount" IS NOT NULL)`)
@Check(`"trading_start" < "trading_end"`)
export class Bot {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('text', { unique: true })
  name: string;

  @Column('text')
  type: BotType;

  @Column('text')
  riskProfile: RiskProfile;

  @Column('text', { default: 'verifying' })
  stage: BotStage;

  @Column('text', { default: 'ready' })
  status: BotStatus;

  // 정지·대기 사유 코드 (예: daily_stop, bot_error)
  @Column('text', { nullable: true })
  statusReason: string | null;

  @Column('text')
  budgetType: AmountType;

  @Column('numeric', {
    precision: 5,
    scale: 4,
    nullable: true,
    transformer: numericTransformer,
  })
  budgetRatio: number | null;

  @Column('bigint', { nullable: true })
  budgetAmount: number | null;

  // 정액 확정 순서 (POL-FUND-14)
  @Column('integer')
  startPriority: number;

  @Column('time')
  tradingStart: string;

  @Column('time')
  tradingEnd: string;

  @Column('date')
  periodStart: string;

  @Column('date', { nullable: true })
  periodEnd: string | null;

  @Column('text')
  onPeriodEnd: HoldingAction;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
