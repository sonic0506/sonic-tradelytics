import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { BotListItem } from '../model/bot.schema';

const TRADING_HOURS = { start: '09:05', end: '15:15' };
const CAP = 100_000;

// Figma Bots 샘플과 같은 숫자예요(홈 샘플과도 맞춰요).
export const BOTS_FIXTURE: BotListItem[] = [
  {
    id: 'bot-a',
    name: '모멘텀 단타 A',
    type: 'day',
    riskProfile: 'aggressive',
    version: 3,
    status: 'running',
    statusReason: null,
    stage: 'released',
    releasedAt: '2026-10-02T15:40:00+09:00',
    endedAt: null,
    releaseProgress: null,
    capAmount: CAP,
    budget: 3_000_000,
    budgetSetting: { type: 'ratio', value: 0.3 },
    fundShortfall: null,
    todayPnl: 92_400,
    todayPnlRate: 3.08,
    activity: 'trading',
    resting: false,
    nextRunAt: null,
    tradingHours: TRADING_HOURS,
  },
  {
    id: 'bot-b',
    name: '종가 베팅 B',
    type: 'closing',
    riskProfile: 'neutral',
    version: 1,
    status: 'running',
    statusReason: null,
    stage: 'verifying',
    releasedAt: null,
    endedAt: null,
    releaseProgress: { passed: 3, total: 5 },
    capAmount: CAP,
    budget: 100_000,
    budgetSetting: { type: 'fixed', value: 2_000_000 },
    fundShortfall: null,
    todayPnl: 1_742,
    todayPnlRate: 1.74,
    activity: 'off_hours',
    resting: true,
    nextRunAt: '2026-10-29T15:10:00+09:00',
    tradingHours: { start: '15:10', end: '15:20' },
  },
  {
    id: 'bot-d',
    name: '스캘핑 D',
    type: 'scalping',
    riskProfile: 'conservative',
    version: 1,
    status: 'waiting_funds',
    statusReason: { code: 'insufficient_funds', count: null, amount: 32_000 },
    stage: 'verifying',
    releasedAt: null,
    endedAt: null,
    releaseProgress: null,
    capAmount: CAP,
    budget: null,
    budgetSetting: { type: 'fixed', value: 1_500_000 },
    fundShortfall: { required: 100_000, available: 68_000 },
    todayPnl: 0,
    todayPnlRate: 0,
    activity: null,
    resting: false,
    nextRunAt: null,
    tradingHours: TRADING_HOURS,
  },
  {
    id: 'bot-e',
    name: '단타 실험 E',
    type: 'day',
    riskProfile: 'aggressive',
    version: 2,
    status: 'stopped',
    statusReason: { code: 'cumulative_loss_limit', count: null, amount: null },
    stage: 'verifying',
    releasedAt: null,
    endedAt: '2026-10-21T13:12:00+09:00',
    releaseProgress: { passed: 1, total: 5 },
    capAmount: CAP,
    budget: null,
    budgetSetting: { type: 'fixed', value: 1_000_000 },
    fundShortfall: null,
    todayPnl: 0,
    todayPnlRate: 0,
    activity: null,
    resting: false,
    nextRunAt: null,
    tradingHours: TRADING_HOURS,
  },
  {
    id: 'bot-c',
    name: '스윙 추세 C',
    type: 'swing',
    riskProfile: 'neutral',
    version: 2,
    status: 'paused',
    statusReason: { code: 'consecutive_losses', count: 3, amount: null },
    stage: 'released',
    releasedAt: '2026-09-24T15:40:00+09:00',
    endedAt: null,
    releaseProgress: null,
    capAmount: CAP,
    budget: 2_500_000,
    budgetSetting: { type: 'fixed', value: 2_500_000 },
    fundShortfall: null,
    todayPnl: -12_300,
    todayPnlRate: -0.49,
    activity: null,
    resting: false,
    nextRunAt: null,
    tradingHours: TRADING_HOURS,
  },
];

export const botHandlers = [
  // /v1/bots/:id보다 먼저 둬서 options가 id로 잡히지 않게 해요
  http.get(mockApiUrl('/v1/bots/options'), () =>
    HttpResponse.json(
      BOTS_FIXTURE.map((bot) => ({ value: bot.id, label: bot.name })),
    ),
  ),
  http.get(mockApiUrl('/v1/bots'), () =>
    HttpResponse.json({
      items: BOTS_FIXTURE,
      meta: { page: 1, size: 100, total: BOTS_FIXTURE.length },
    }),
  ),
  // 설정 저장(투자금 줄이고 다시 시작 등). 저장한 값을 돌려줘요.
  http.patch(mockApiUrl('/v1/bots/:id'), async ({ params, request }) => {
    const body: unknown = await request.json();
    return HttpResponse.json({ id: params.id, body });
  }),
];
