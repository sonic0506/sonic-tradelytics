import type { RiskEventKind } from '@/entities/risk-event';

// 운영 화면의 종류 배지 색 (Figma Ops). 이름은 entity의 RISK_EVENT_KIND_LABEL이에요. 봇을 끝내거나 주문이 막힌 일은 danger,
// 매매를 멈추거나 기다리는 일은 warning, 알려 두기만 하는 일은 neutral이에요
export const OPS_KIND_TONE: Record<
  RiskEventKind,
  'danger' | 'warning' | 'neutral'
> = {
  daily_loss_limit: 'warning',
  cumulative_loss_limit: 'danger',
  consecutive_losses: 'warning',
  feed_stale: 'neutral',
  insufficient_funds: 'warning',
  order_rejected: 'danger',
};
