import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 배분 기준 시점의 운용 자산 (POL-FUND-01, 02, 09). 추가만 해요.
@Entity('account_snapshots')
export class AccountSnapshot {
  @PrimaryGeneratedColumn('identity', {
    type: 'bigint',
    generatedIdentity: 'ALWAYS',
  })
  id: number;

  @Column('timestamptz')
  takenAt: Date;

  // 토스 cashBuyingPower
  @Column('bigint')
  orderableCash: number;

  @Column('bigint')
  runningBotsCashShare: number;

  // 운용 자산. 계산식이 코드와 어긋나지 않게 DB가 계산해요
  @Column({
    type: 'bigint',
    generatedType: 'STORED',
    asExpression: '"orderable_cash" - "running_bots_cash_share"',
    insert: false,
    update: false,
  })
  availableCapital: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
