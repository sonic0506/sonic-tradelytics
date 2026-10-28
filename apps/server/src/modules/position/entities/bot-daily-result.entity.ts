import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { Bot, BotVersion } from '@/modules/bot/index.js';

// 장후 배치의 봇별 일일 집계 (FR-PERF-03).
@Entity('bot_daily_results')
export class BotDailyResult {
  @PrimaryColumn('bigint')
  botId: number;

  @ManyToOne(() => Bot, { nullable: false })
  @JoinColumn()
  bot: Bot;

  @PrimaryColumn('date')
  tradeDate: string;

  // 그날 적용된 버전 (검증 기준 계산, POL-RISK-13)
  @Column('bigint')
  botVersionId: number;

  @ManyToOne(() => BotVersion, { nullable: false })
  @JoinColumn()
  botVersion: BotVersion;

  @Column('bigint')
  realizedPnl: number;

  @Column('bigint')
  unrealizedPnl: number;

  @Column('bigint')
  fees: number;

  @Column('integer')
  closedTrades: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
