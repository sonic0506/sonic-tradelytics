import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type {
  AllocationPreview,
  GetAllocationPreview,
} from '../model/allocation.schema';

// Figma Bot Create / 2 자금·기간 예상 배분과 같은 숫자예요.
const CAPITAL = 3_215_400;
const VERIFYING_CAP = 100_000;
const RUNNING_RATIO = 0.3;

export const allocationHandlers = [
  http.post(mockApiUrl('/v1/allocation-previews'), async ({ request }) => {
    const { budget, periodStart, tradingStart } =
      (await request.json()) as GetAllocationPreview;
    const isRatio = budget.type === 'ratio';
    const ratioTotal = RUNNING_RATIO + (isRatio ? budget.value : 0);
    const requested = isRatio ? budget.value * CAPITAL : budget.value;
    const amount = Math.min(requested, VERIFYING_CAP);
    const remaining = CAPITAL * (1 - RUNNING_RATIO);
    const outcome = isRatio
      ? ratioTotal > 1
        ? 'blocked'
        : 'confirmed'
      : amount <= remaining
        ? 'confirmed'
        : 'pending';
    const body: AllocationPreview = {
      basedAt: '2026-10-30T14:32:00+09:00',
      capital: CAPITAL,
      startAt: `${periodStart}T${tradingStart}:00+09:00`,
      ratioTotal,
      items: [
        {
          botId: 'bot-a',
          name: '모멘텀 단타 A',
          budget: { type: 'ratio', value: RUNNING_RATIO },
          amount: RUNNING_RATIO * CAPITAL,
          outcome: 'confirmed',
        },
        {
          botId: null,
          name: null,
          budget,
          amount: outcome === 'confirmed' ? amount : null,
          outcome,
        },
      ],
    };
    return HttpResponse.json(body);
  }),
];
