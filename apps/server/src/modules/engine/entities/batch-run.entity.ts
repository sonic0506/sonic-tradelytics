import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';

import {
  BATCH_JOBS,
  BATCH_RESULTS,
  type BatchJob,
  type BatchResult,
} from '../engine.constants.js';

// engine 배치 실행 기록. 시작 시 놓친 배치를 찾는 데 써요.
@Entity('batch_runs')
// 같은 배치를 두 번 시작하지 않아요. 실패한 배치를 다시 돌리면 같은 행을 갱신해요
@Unique(['job', 'tradeDate', 'slot'])
@Check(oneOf('job', BATCH_JOBS))
@Check(oneOf('result', BATCH_RESULTS))
export class BatchRun {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('text')
  job: BatchJob;

  @Column('date')
  tradeDate: string;

  // 하루 여러 번 도는 job의 회차 (예: intraday_check의 11:00)
  @Column('text', { default: '' })
  slot: string;

  @Column('timestamptz')
  startedAt: Date;

  @Column('timestamptz', { nullable: true })
  finishedAt: Date | null;

  @Column('text', { nullable: true })
  result: BatchResult | null;

  @Column('text', { nullable: true })
  error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
