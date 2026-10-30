import type { RiskEventKind } from '@/entities/risk-event';

// 운영 화면의 종류 배지 (Figma Ops). 봇을 끝내거나 주문이 막힌 일은 danger,
// 매매를 멈추거나 기다리는 일은 warning, 알려 두기만 하는 일은 neutral이에요
export const OPS_KIND_BADGE: Record<
  RiskEventKind,
  { label: string; tone: 'danger' | 'warning' | 'neutral' }
> = {
  daily_loss_limit: { label: '하루 한도', tone: 'warning' },
  cumulative_loss_limit: { label: '누적 한도', tone: 'danger' },
  consecutive_losses: { label: '연속 손절', tone: 'warning' },
  feed_stale: { label: '시세 끊김', tone: 'neutral' },
  insufficient_funds: { label: '자금 부족', tone: 'warning' },
  order_rejected: { label: '주문 거부', tone: 'danger' },
};
