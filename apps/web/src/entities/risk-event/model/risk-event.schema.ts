import { z } from 'zod';

import { listResponseSchema } from '@/shared/api';

export const RISK_EVENT_KINDS = [
  'daily_loss_limit',
  'cumulative_loss_limit',
  'consecutive_losses',
  'feed_stale',
  'insufficient_funds',
  'order_rejected',
] as const;
export const riskEventKindSchema = z.enum(RISK_EVENT_KINDS);

// GET /v1/risk-events 한 줄 (POL-RISK-12)
export const riskEventSchema = z.object({
  id: z.string(),
  occurredAt: z.string(),
  kind: riskEventKindSchema,
  botName: z.string().nullable(),
  message: z.string(),
  notifiedAt: z.string().nullable(),
});

export const riskEventsSchema = listResponseSchema(riskEventSchema);

export type RiskEvent = z.infer<typeof riskEventSchema>;
export type RiskEventKind = z.infer<typeof riskEventKindSchema>;

export const RISK_EVENT_KIND_LABEL: Record<RiskEventKind, string> = {
  daily_loss_limit: '일 손실 한도',
  cumulative_loss_limit: '누적 손실 한도',
  consecutive_losses: '연속 손실',
  feed_stale: '시세 끊김',
  insufficient_funds: '자금 부족',
  order_rejected: '주문 거부',
};

// 매매를 멈춘 사건은 danger, 알려 두는 사건은 warning이에요.
export const RISK_EVENT_KIND_TONE: Record<RiskEventKind, 'danger' | 'warning'> =
  {
    daily_loss_limit: 'danger',
    cumulative_loss_limit: 'danger',
    order_rejected: 'danger',
    consecutive_losses: 'warning',
    feed_stale: 'warning',
    insufficient_funds: 'warning',
  };
