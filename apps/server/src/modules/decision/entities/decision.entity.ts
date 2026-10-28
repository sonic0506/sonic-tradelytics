import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { oneOf } from '@/common/database/check.js';
import { BotVersion } from '@/modules/bot/index.js';
import { Position } from '@/modules/position/index.js';

import {
  DECISION_KINDS,
  type DecisionKind,
  type Direction,
  DIRECTIONS,
  type RuleResult,
  SKIP_REASONS,
  type SkipReason,
} from '../decision.constants.js';

// 근거 카드의 원본. 주문 전에 저장하고 추가만 해요 (ADR-0003).
@Entity('decisions')
@Index(['botVersionId', 'decidedAt'])
@Index(['positionId'])
@Index(['symbol', 'decidedAt'])
@Check(oneOf('kind', DECISION_KINDS))
@Check(oneOf('direction', DIRECTIONS))
@Check(oneOf('skip_reason', SKIP_REASONS))
@Check(`"score" BETWEEN 0 AND 100`)
@Check(`("kind" = 'skip') = ("skip_reason" IS NOT NULL)`)
// 채점할 판단은 예측이 있어야 해요
@Check(
  `"kind" NOT IN ('enter', 'reeval') OR ("direction" IS NOT NULL AND "target_price" IS NOT NULL AND "stop_price" IS NOT NULL)`,
)
export class Decision {
  // 그대로 clientOrderId로 써요. 주문 전에 코드에서 만들어요
  @PrimaryColumn('uuid')
  id: string;

  @Column('bigint')
  botVersionId: number;

  @ManyToOne(() => BotVersion, { nullable: false })
  @JoinColumn()
  botVersion: BotVersion;

  // 건너뛴 판단은 null
  @Column('bigint', { nullable: true })
  positionId: number | null;

  @ManyToOne(() => Position)
  @JoinColumn()
  position: Position | null;

  @Column('text')
  symbol: string;

  @Column('text')
  kind: DecisionKind;

  @Column('timestamptz')
  decidedAt: Date;

  @Column('bigint')
  price: number;

  @Column('jsonb')
  passed: RuleResult[];

  @Column('jsonb')
  failed: RuleResult[];

  @Column('smallint', { nullable: true })
  score: number | null;

  @Column('text', { nullable: true })
  direction: Direction | null;

  @Column('bigint', { nullable: true })
  targetPrice: number | null;

  @Column('bigint', { nullable: true })
  stopPrice: number | null;

  @Column('integer', { nullable: true })
  horizonMinutes: number | null;

  @Column('text', { nullable: true })
  skipReason: SkipReason | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
