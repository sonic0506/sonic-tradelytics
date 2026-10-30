import { z } from 'zod';

import { listResponseSchema } from '@/shared/api';

// risk_events.kind (data-model.md, 서버 risk.constants.ts와 같은 값)
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
export const riskEventKindSchema = z.enum(RISK_EVENT_KINDS);

// GET /v1/risk-events 한 줄 (POL-RISK-12). 문구는 서버가 주지 않고 web이 kind·detail로 만들어요
export const riskEventSchema = z.object({
  id: z.string(),
  botId: z.string().nullable(),
  botName: z.string().nullable(),
  kind: riskEventKindSchema,
  occurredAt: z.string(),
  // 기준값과 실제 값. 종류마다 키가 달라요 (예: 손실 한도의 amount·dailyPnl)
  detail: z.record(z.string(), z.unknown()),
  notifiedAt: z.string().nullable(),
});

export const riskEventsSchema = listResponseSchema(riskEventSchema);

export type RiskEvent = z.infer<typeof riskEventSchema>;
export type RiskEventKind = z.infer<typeof riskEventKindSchema>;

export const RISK_EVENT_KIND_LABEL: Record<RiskEventKind, string> = {
  daily_stop: '하루 한도',
  total_stop: '누적 한도',
  streak_pause: '연속 손절',
  rate_cap: '주문 상한',
  kill_switch: '킬 스위치',
  batch_fail: '배치 실패',
  feed_stale: '시세 끊김',
  record_fail: '기록 실패',
  order_rejected: '주문 거부',
  funds_waiting: '자금 대기',
  bot_error: '봇 오류',
};

// 매매를 멈춘 사건은 danger, 알려 두는 사건은 warning이에요.
export const RISK_EVENT_KIND_TONE: Record<RiskEventKind, 'danger' | 'warning'> =
  {
    daily_stop: 'danger',
    total_stop: 'danger',
    kill_switch: 'danger',
    record_fail: 'danger',
    order_rejected: 'danger',
    bot_error: 'danger',
    streak_pause: 'warning',
    rate_cap: 'warning',
    batch_fail: 'warning',
    feed_stale: 'warning',
    funds_waiting: 'warning',
  };
