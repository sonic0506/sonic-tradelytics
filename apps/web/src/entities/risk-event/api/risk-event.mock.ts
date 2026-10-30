import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { RiskEvent } from '../model/risk-event.schema';

export const RISK_EVENTS_FIXTURE: RiskEvent[] = [
  {
    id: 'risk-3',
    occurredAt: '2026-10-29T13:05:00+09:00',
    kind: 'daily_loss_limit',
    botName: '모멘텀 단타 A',
    message: '모멘텀 단타 A가 일 손실 한도 3%에 닿아 오늘 매매를 멈췄어요.',
    notifiedAt: '2026-10-29T13:05:02+09:00',
  },
  {
    id: 'risk-2',
    occurredAt: '2026-10-29T11:40:00+09:00',
    kind: 'consecutive_losses',
    botName: '스윙 추세 C',
    message: '스윙 추세 C가 3연속 손실로 일시정지했어요.',
    notifiedAt: '2026-10-29T11:40:01+09:00',
  },
  {
    id: 'risk-1',
    occurredAt: '2026-10-29T09:00:00+09:00',
    kind: 'insufficient_funds',
    botName: '스캘핑 D',
    message: '스캘핑 D는 주문 가능 금액이 모자라 자금 대기 중이에요.',
    notifiedAt: '2026-10-29T09:00:03+09:00',
  },
];

export const riskEventHandlers = [
  http.get(mockApiUrl('/v1/risk-events'), () =>
    HttpResponse.json({
      items: RISK_EVENTS_FIXTURE,
      meta: { page: 1, size: 3, total: RISK_EVENTS_FIXTURE.length },
    }),
  ),
];
