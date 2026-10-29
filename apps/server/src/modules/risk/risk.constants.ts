// POL-RISK-02~04, 08, 11, POL-REEV-05. 알림(POL-RISK-12)의 근거예요
export const RISK_EVENT_KINDS = [
  'daily_stop',
  'total_stop',
  'streak_pause',
  'rate_cap',
  'kill_switch',
  'batch_fail',
  'feed_stale',
  'record_fail',
  'order_rejected',
  'funds_waiting',
  'bot_error',
] as const;
export type RiskEventKind = (typeof RISK_EVENT_KINDS)[number];

// 손실 한도를 보는 단위. 스윙은 종목당, 종가 베팅은 진입 1회당이라 둘 다 포지션 단위예요 (POL-RISK-01)
export const LOSS_SCOPES = ['day', 'position'] as const;
export type LossScope = (typeof LOSS_SCOPES)[number];

// POL-RISK-01 성향별 기본 손실 한도(%, 양수로 저장). 시작용 예시라 검증 구간 결과를 보고 조정해요
export const DEFAULT_LOSS_LIMITS = {
  scalping: {
    aggressive: { scope: 'day', lossPct: 5, totalLossPct: 15 },
    neutral: { scope: 'day', lossPct: 3, totalLossPct: 10 },
    conservative: { scope: 'day', lossPct: 2, totalLossPct: 6 },
  },
  day_trading: {
    aggressive: { scope: 'day', lossPct: 6, totalLossPct: 15 },
    neutral: { scope: 'day', lossPct: 4, totalLossPct: 10 },
    conservative: { scope: 'day', lossPct: 2, totalLossPct: 6 },
  },
  swing: {
    aggressive: { scope: 'position', lossPct: 7, totalLossPct: 15 },
    neutral: { scope: 'position', lossPct: 5, totalLossPct: 10 },
    conservative: { scope: 'position', lossPct: 3, totalLossPct: 5 },
  },
  closing_bet: {
    aggressive: { scope: 'position', lossPct: 5, totalLossPct: 15 },
    neutral: { scope: 'position', lossPct: 3, totalLossPct: 10 },
    conservative: { scope: 'position', lossPct: 2, totalLossPct: 6 },
  },
} as const satisfies Record<
  string,
  Record<string, { scope: LossScope; lossPct: number; totalLossPct: number }>
>;

// POL-RISK-04 연속 손절 기본 횟수 (제안값)
export const DEFAULT_STOP_STREAK = 3;

// POL-RISK-08 주문 횟수 상한. 토스 어뷰징 기준보다 충분히 낮게 잡은 처음 값이에요
export const BOT_ORDERS_PER_MINUTE = 6;
export const ACCOUNT_ORDERS_PER_DAY = 300;

// 한도에 걸려 봇을 멈춘 사유 (bots.status_reason, risk_events.kind와 같은 값)
export const STOP_REASONS = [
  'daily_stop',
  'total_stop',
  'streak_pause',
  'rate_cap',
] as const;
export type StopReason = (typeof STOP_REASONS)[number];

// POL-RISK-06 진입 금지 사유
export const ENTRY_BAN_REASONS = [
  'vi',
  'market_alert',
  'liquidation',
  'suspended',
  'unknown_warning',
] as const;
export type EntryBanReason = (typeof ENTRY_BAN_REASONS)[number];
