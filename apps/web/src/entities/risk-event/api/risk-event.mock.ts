import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { RiskEvent } from '../model/risk-event.schema';

export const RISK_EVENTS_FIXTURE: RiskEvent[] = [
  {
    id: 'risk-3',
    occurredAt: '2026-10-29T13:05:00+09:00',
    kind: 'daily_stop',
    botId: 'bot-a',
    botName: '모멘텀 단타 A',
    detail: { amount: 3_000_000, dailyPnl: -93_000, totalPnl: 41_000 },
    notifiedAt: '2026-10-29T13:05:02+09:00',
  },
  {
    id: 'risk-2',
    occurredAt: '2026-10-29T11:40:00+09:00',
    kind: 'streak_pause',
    botId: 'bot-c',
    botName: '스윙 추세 C',
    detail: { stopStreak: 3 },
    notifiedAt: '2026-10-29T11:40:01+09:00',
  },
  {
    id: 'risk-1',
    occurredAt: '2026-10-29T09:00:00+09:00',
    kind: 'funds_waiting',
    botId: 'bot-d',
    botName: '스캘핑 D',
    detail: { reason: 'insufficient' },
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
