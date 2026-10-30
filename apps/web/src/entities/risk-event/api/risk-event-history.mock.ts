import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { RiskEvent } from '../model/risk-event.schema';

// Figma Ops / 정상과 같은 기록이에요. botName이 null이면 봇 전체에 해당해요
const OPS_EVENTS: (RiskEvent & { botId: string | null })[] = [
  {
    id: 'ops-6',
    occurredAt: '2026-10-29T13:05:00+09:00',
    kind: 'daily_loss_limit',
    botId: 'bot-a',
    botName: '모멘텀 단타 A',
    message: '하루 손실 −3.1%로 한도 −3%에 닿아 오늘 신규 진입을 멈췄어요.',
    notifiedAt: '2026-10-29T13:05:02+09:00',
  },
  {
    id: 'ops-5',
    occurredAt: '2026-10-29T11:40:00+09:00',
    kind: 'consecutive_losses',
    botId: 'bot-c',
    botName: '스윙 추세 C',
    message: '3번 연속 손절해서 일시정지했어요. 재개는 직접 눌러야 해요.',
    notifiedAt: '2026-10-29T11:40:01+09:00',
  },
  {
    id: 'ops-4',
    occurredAt: '2026-10-29T10:12:00+09:00',
    kind: 'feed_stale',
    botId: null,
    botName: null,
    message: '셀트리온 시세가 32초 끊겼다가 다시 들어왔어요.',
    notifiedAt: null,
  },
  {
    id: 'ops-3',
    occurredAt: '2026-10-29T09:00:00+09:00',
    kind: 'insufficient_funds',
    botId: 'bot-d',
    botName: '스캘핑 D',
    message: '32,000원이 모자라 자금 대기로 바꿨어요.',
    notifiedAt: '2026-10-29T09:00:03+09:00',
  },
  {
    id: 'ops-2',
    occurredAt: '2026-10-28T14:52:00+09:00',
    kind: 'order_rejected',
    botId: 'bot-a',
    botName: '모멘텀 단타 A',
    message: '기아 매수 주문이 거부됐어요. 반대 방향 미체결 주문이 있었어요.',
    notifiedAt: '2026-10-28T14:52:01+09:00',
  },
  {
    id: 'ops-1',
    occurredAt: '2026-10-21T11:18:00+09:00',
    kind: 'cumulative_loss_limit',
    botId: 'bot-e',
    botName: '단타 실험 E',
    message: '누적 손실 −15.0%로 한도에 닿아 봇을 끝냈어요.',
    notifiedAt: '2026-10-21T11:18:02+09:00',
  },
];

// 운영 화면 요청(page가 있는 요청)만 받아요. 나머지는 riskEventHandlers로 넘겨요
export const riskEventHistoryHandlers = [
  http.get(mockApiUrl('/v1/risk-events'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    if (!query.has('page')) return undefined;
    const page = Number(query.get('page') ?? 1);
    const size = Number(query.get('size') ?? 20);
    const botIds = query.get('botIds')?.split(',').filter(Boolean) ?? [];
    const kind = query.get('kinds');
    const from = query.get('from');
    const to = query.get('to');
    const rows = OPS_EVENTS.filter((event) => {
      const day = event.occurredAt.slice(0, 10);
      if (botIds.length > 0 && (!event.botId || !botIds.includes(event.botId)))
        return false;
      if (kind && event.kind !== kind) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      return true;
    });
    return HttpResponse.json({
      items: rows.slice((page - 1) * size, page * size),
      meta: { page, size, total: rows.length },
    });
  }),
];
