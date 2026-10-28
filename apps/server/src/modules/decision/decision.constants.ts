export const DECISION_KINDS = ['enter', 'exit', 'skip', 'reeval'] as const;
export type DecisionKind = (typeof DECISION_KINDS)[number];

export const DIRECTIONS = ['up', 'down'] as const;
export type Direction = (typeof DIRECTIONS)[number];

// 건너뛴 사유 (FR-RAT-03, 04). rate_limit은 호출 한도 부족 (NFR-03)
export const SKIP_REASONS = [
  'entry_condition',
  'risk',
  'funds',
  'symbol_lock',
  'market_alert',
  'order_rejected',
  'rate_limit',
] as const;
export type SkipReason = (typeof SKIP_REASONS)[number];

// 충족·탈락한 조건 하나. 규칙 id와 숫자만 (FR-RAT-07)
export interface RuleResult {
  rule: string;
  value: number;
  threshold: number;
}
