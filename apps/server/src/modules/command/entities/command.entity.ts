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

import {
  COMMAND_KINDS,
  COMMAND_RESULTS,
  type CommandKind,
  type CommandResult,
} from '../command.constants.js';

// api가 넣고 같은 트랜잭션에서 NOTIFY command, engine이 처리해요 (ADR-0004).
@Entity('commands')
// engine 시작 시 미처리 명령 재조회
@Index(['requestedAt'], { where: `"handled_at" IS NULL` })
@Check(oneOf('kind', COMMAND_KINDS))
@Check(oneOf('result', COMMAND_RESULTS))
@Check(`("kind" = 'kill') = ("bot_id" IS NULL)`)
export class Command {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('text')
  kind: CommandKind;

  // kill은 null (모든 봇)
  @Column('bigint', { nullable: true })
  botId: number | null;

  @ManyToOne(() => Bot)
  @JoinColumn()
  bot: Bot | null;

  // 킬 스위치의 "전량 청산" 선택
  @Column('boolean', { default: false })
  liquidateAll: boolean;

  // rebudget의 새 투자금 설정(방식·금액·1회 주문 금액). 다른 명령은 null
  @Column('jsonb', { nullable: true })
  budget: Record<string, unknown> | null;

  @Column('timestamptz')
  requestedAt: Date;

  // engine 처리 시각. null이면 미처리
  @Column('timestamptz', { nullable: true })
  handledAt: Date | null;

  @Column('text', { nullable: true })
  result: CommandResult | null;

  @Column('text', { nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
