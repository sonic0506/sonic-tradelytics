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
