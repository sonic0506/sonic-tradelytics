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

import { AccountSnapshot } from '@/modules/account/index.js';
import { Bot } from '@/modules/bot/index.js';

// 봇의 확정 투자금과 반환 (POL-FUND-04, 06). 반환될 때 released_*만 채워요.
@Entity('allocations')
// 봇당 살아 있는 배분은 1개
@Index(['botId'], { unique: true, where: `"released_at" IS NULL` })
@Check(`"amount" > 0`)
@Check(`("released_at" IS NULL) = ("released_amount" IS NULL)`)
export class Allocation {
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

  // 같은 시각 시작 봇들은 같은 스냅샷 (POL-FUND-01)
  @Column('bigint')
  snapshotId: number;

  @ManyToOne(() => AccountSnapshot, { nullable: false })
  @JoinColumn()
  snapshot: AccountSnapshot;

  @Column('bigint')
  amount: number;

  // 검증 구간 상한으로 줄었는지 (POL-FUND-11)
  @Column('boolean')
  capped: boolean;

  @Column('timestamptz', { nullable: true })
  releasedAt: Date | null;

  @Column('bigint', { nullable: true })
  releasedAmount: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
