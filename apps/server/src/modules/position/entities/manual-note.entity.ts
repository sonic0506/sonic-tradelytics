import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Position } from './position.entity.js';

// 직접 거래 근거 (FR-MAN-03). 자유 문장 메모를 허용해요(F4 예외).
@Entity('manual_notes')
export class ManualNote {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('bigint')
  positionId: number;

  @OneToOne(() => Position, { nullable: false })
  @JoinColumn()
  position: Position;

  @Column('text', { nullable: true })
  memo: string | null;

  @Column('bigint', { nullable: true })
  targetPrice: number | null;

  @Column('bigint', { nullable: true })
  stopPrice: number | null;

  @Column('integer', { nullable: true })
  horizonMinutes: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
