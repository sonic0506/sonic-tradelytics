import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { numericTransformer } from '@/common/database/numeric.transformer.js';
import { Position } from '@/modules/position/index.js';

import { Decision } from './decision.entity.js';

// 예측 채점 (FR-RAT-02, POL-REEV-04). 진입·재평가 판단마다 하나, 추가만 해요.
// 채점 정의는 docs/product/features/f3-rationale-report.md에만 있어요.
@Entity('prediction_scores')
@Check(`"target_reach_pct" BETWEEN 0 AND 100`)
export class PredictionScore {
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

  @Column('uuid')
  decisionId: string;

  @OneToOne(() => Decision, { nullable: false })
  @JoinColumn()
  decision: Decision;

  @Column('boolean')
  directionHit: boolean;

  @Column('numeric', {
    precision: 5,
    scale: 2,
    transformer: numericTransformer,
  })
  targetReachPct: number;

  @Column('numeric', {
    precision: 7,
    scale: 3,
    transformer: numericTransformer,
  })
  errorPct: number;

  @Column('timestamptz')
  scoredAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
