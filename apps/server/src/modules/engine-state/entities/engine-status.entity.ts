import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';

import {
  ENGINE_STATES,
  type EngineStateValue,
} from '../engine-state.constants.js';

// engine이 화면용으로 5초마다 덮어쓰는 한 행. api는 토스를 부르지 않아서 여기서 읽어요.
@Entity('engine_statuses')
@Check(`"id" = 1`)
@Check(oneOf('state', ENGINE_STATES))
export class EngineStatus {
  @PrimaryColumn('smallint')
  id: number;

  @Column('text')
  state: EngineStateValue;

  // 전체 정지 사유 (kill, token, record_fail)
  @Column('text', { array: true, default: () => `'{}'` })
  haltReasons: string[];

  // 시세가 끊긴 종목
  @Column('text', { array: true, default: () => `'{}'` })
  staleSymbols: string[];

  // 토스 cashBuyingPower 최근 값
  @Column('bigint', { nullable: true })
  orderableCash: number | null;

  // 보유 종목 평가금액 합
  @Column('bigint', { nullable: true })
  holdingsValue: number | null;

  @Column('timestamptz', { nullable: true })
  accountSyncedAt: Date | null;

  @Column('timestamptz')
  heartbeatAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
