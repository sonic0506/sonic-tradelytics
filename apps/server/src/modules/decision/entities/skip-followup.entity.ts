import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';

import { Decision } from './decision.entity.js';

// 건너뛴 판단의 이후 가격 (FR-RAT-04). 장후 배치가 채워요.
@Entity('skip_followups')
export class SkipFollowup {
  @PrimaryColumn('uuid')
  decisionId: string;

  @OneToOne(() => Decision, { nullable: false })
  @JoinColumn()
  decision: Decision;

  @Column('bigint')
  closePrice: number;

  @Column('bigint')
  maxAfter: number;

  @Column('bigint')
  minAfter: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
