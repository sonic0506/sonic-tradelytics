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
import { Bot } from '@/modules/bot/index.js';

import { RISK_EVENT_KINDS, type RiskEventKind } from '../risk.constants.js';

// 리스크·장애 이벤트. 추가만 하고, notified_at만 한 번 채워요.
@Entity('risk_events')
@Index(['botId', 'occurredAt'])
@Check(oneOf('kind', RISK_EVENT_KINDS))
export class RiskEvent {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  // 전체 대상이면 null
  @Column('bigint', { nullable: true })
  botId: number | null;

  @ManyToOne(() => Bot)
  @JoinColumn()
  bot: Bot | null;

  @Column('text')
  kind: RiskEventKind;

  @Column('timestamptz')
  occurredAt: Date;

  // 기준값과 실제 값 (예: { limitPct: -4, actualPct: -4.2 })
  @Column('jsonb')
  detail: Record<string, unknown>;

  // 텔레그램 발송 시각
  @Column('timestamptz', { nullable: true })
  notifiedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
