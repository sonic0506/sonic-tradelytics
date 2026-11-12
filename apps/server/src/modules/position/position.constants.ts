export const POSITION_STATUSES = ['open', 'closed'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

// F2 청산 사유. not_filled는 한 주도 체결되지 않고 끝난 포지션이에요.
// rule_exit는 익절·손절이 아닌 규칙 청산(예: VWAP 이탈), loss_limit는 손실 한도 도달 청산이에요 (POL-RISK-02, 03)
export const EXIT_REASONS = [
  'take_profit',
  'stop_loss',
  'time_exit',
  'market_close',
  'rule_exit',
  'loss_limit',
  'reeval',
  'manual',
  'kill_switch',
  'not_filled',
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];

// 투자 내역 화면의 상태 (api.md GET /v1/positions): 보유 중 · 미체결 · 청산 완료 · 취소(not_filled)
export const POSITION_VIEWS = [
  'holding',
  'pending',
  'closed',
  'canceled',
] as const;
export type PositionView = (typeof POSITION_VIEWS)[number];

export const POSITION_RESULTS = ['profit', 'loss'] as const;
export type PositionResult = (typeof POSITION_RESULTS)[number];
