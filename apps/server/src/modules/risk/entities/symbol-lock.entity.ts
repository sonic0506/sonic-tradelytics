import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Bot } from '@/modules/bot/index.js';

// 종목 잠금 (POL-RISK-16). 잠금 획득은 INSERT 성공 여부로 판단해요.
@Entity('symbol_locks')
// 두 봇이 동시에 잡으려 해도 DB가 하나만 통과시켜요
@Index(['symbol'], { unique: true, where: `"released_at" IS NULL` })
export class SymbolLock {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('text')
  symbol: string;

  @Column('bigint')
  botId: number;

  @ManyToOne(() => Bot, { nullable: false })
  @JoinColumn()
  bot: Bot;

  @Column('timestamptz')
  acquiredAt: Date;

  @Column('timestamptz', { nullable: true })
  releasedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
