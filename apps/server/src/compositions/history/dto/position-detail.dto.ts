import { ApiProperty } from '@nestjs/swagger';

import { type Direction, DIRECTIONS } from '@/modules/decision/index.js';
import {
  ORDER_ORIGINS,
  ORDER_SIDES,
  type OrderOrigin,
  type OrderSide,
} from '@/modules/order/index.js';

import { PositionRowResponseDto } from './position-row.dto.js';

export const ORDER_KINDS = ['normal', 'stop_condition'] as const;
export const ORDER_VIEWS = [
  'filled',
  'partial',
  'pending',
  'canceled',
] as const;
export const ACTUAL_DIRECTIONS = ['up', 'down', 'flat'] as const;
export const TIMELINE_KINDS = ['enter', 'reeval', 'exit'] as const;

// 포지션의 주문 한 줄 (FR-PERF-04)
export class PositionOrderDto {
  id: string;

  @ApiProperty({ enum: ORDER_SIDES })
  side: OrderSide;

  /** stop_condition은 손절 조건주문이 발동한 주문이에요 */
  @ApiProperty({ enum: ORDER_KINDS })
  kind: (typeof ORDER_KINDS)[number];

  orderedAt: Date;
  quantity: number;

  /** 평균 체결가. 체결이 없으면 null */
  avgPrice: number | null;

  commission: number;
  tax: number;

  @ApiProperty({ enum: ORDER_VIEWS })
  status: (typeof ORDER_VIEWS)[number];

  /** 체결·취소된 시각 */
  statusAt: Date | null;

  @ApiProperty({ enum: ORDER_ORIGINS })
  origin: OrderOrigin;
}

export class RuleConditionDto {
  label: string;
  /** "기준 5% 이상"처럼 비교 기준 */
  rule: string;
  value: string;
  passed: boolean;
}

export class PredictionDto {
  @ApiProperty({ enum: DIRECTIONS })
  direction: Direction;

  targetPrice: number;
  /** 판단 가격 대비 %, 소수 첫째 자리 */
  targetRate: number;
  stopPrice: number;
  stopRate: number;
  /** "15:20까지"처럼 예상 보유. 예상 보유 시간이 없으면 빈 문자열 */
  holdUntil: string;
}

// 주문 직전에 남긴 진입 판단 (FR-RAT-01)
export class EntryDecisionDto {
  decidedAt: Date;
  price: number;
  score: number;
  conditions: RuleConditionDto[];
  prediction: PredictionDto;
}

// 청산 뒤 실제 결과 (FR-RAT-02)
export class PositionOutcomeDto {
  exitPrice: number;
  holdingMinutes: number;
  /** 보유 중 최고가. 기록이 없으면 진입·청산가 중 높은 값 */
  highPrice: number;
  /** 최고가 시각. 아직 기록하지 않아 null */
  highAt: Date | null;
  lowPrice: number;
  lowAt: Date | null;
}

export class PositionScoringDto {
  directionHit: boolean;

  @ApiProperty({ enum: ACTUAL_DIRECTIONS })
  actualDirection: (typeof ACTUAL_DIRECTIONS)[number];

  /** 0~100 */
  targetReachPct: number;
  /** (청산가 − 목표가) ÷ 진입가, % */
  errorPct: number;
}

export class TimelineItemDto {
  at: Date;

  @ApiProperty({ enum: TIMELINE_KINDS })
  kind: (typeof TIMELINE_KINDS)[number];

  title: string;
  detail: string;
}

// GET /v1/positions/:id: 펼친 거래 한 줄과 근거 카드 (F3)
export class PositionDetailDto {
  id: string;
  position: PositionRowResponseDto;

  /** 판단에 쓴 규칙 값 버전 번호. 직접 거래면 null */
  botVersion: number | null;

  orders: PositionOrderDto[];

  /** 직접 거래거나 진입 판단이 없으면 null */
  entry: EntryDecisionDto | null;

  /** 청산 전이면 null */
  outcome: PositionOutcomeDto | null;

  /** 채점 전이면 null */
  scoring: PositionScoringDto | null;

  timeline: TimelineItemDto[];
}
