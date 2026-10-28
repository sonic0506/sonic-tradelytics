export const POSITION_STATUSES = ['open', 'closed'] as const;
export type PositionStatus = (typeof POSITION_STATUSES)[number];

// F2 청산 사유. not_filled는 한 주도 체결되지 않고 끝난 포지션이에요
export const EXIT_REASONS = [
  'take_profit',
  'stop_loss',
  'time_exit',
  'market_close',
  'reeval',
  'manual',
  'kill_switch',
  'not_filled',
] as const;
export type ExitReason = (typeof EXIT_REASONS)[number];
