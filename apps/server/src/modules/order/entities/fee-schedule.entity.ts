import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { numericTransformer } from '@/common/database/numeric.transformer.js';

// PaperBroker 체결 계산용 수수료·세금률 (ADR-0005). 실전 손익은 토스 execution 값을 써요.
@Entity('fee_schedules')
export class FeeSchedule {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('date', { unique: true })
  effectiveFrom: string;

  // 토스 commissions 값
  @Column('numeric', {
    precision: 8,
    scale: 6,
    transformer: numericTransformer,
  })
  commissionRate: number;

  @Column('numeric', {
    precision: 8,
    scale: 6,
    transformer: numericTransformer,
  })
  taxRate: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
