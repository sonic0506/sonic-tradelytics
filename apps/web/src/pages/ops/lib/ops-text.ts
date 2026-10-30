import type { RiskEventKind } from '@/entities/risk-event';

// 운영 화면의 종류 배지 색 (Figma Ops). 이름은 entity의 RISK_EVENT_KIND_LABEL이에요. 봇을 끝내거나 주문이 막힌 일은 danger,
// 매매를 멈추거나 기다리는 일은 warning, 알려 두기만 하는 일은 neutral이에요
export const OPS_KIND_TONE: Record<
  RiskEventKind,
  'danger' | 'warning' | 'neutral'
> = {
  daily_stop: 'warning',
  total_stop: 'danger',
  streak_pause: 'warning',
  rate_cap: 'warning',
  kill_switch: 'danger',
  batch_fail: 'warning',
  feed_stale: 'neutral',
  record_fail: 'danger',
  order_rejected: 'danger',
  funds_waiting: 'warning',
  bot_error: 'danger',
};
