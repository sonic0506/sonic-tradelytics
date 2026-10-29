import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { HomeSummary } from '../model/home-summary.schema';

// Figma Home 샘플과 같은 숫자예요. 봇 오늘 손익의 합이 todayPnl.amount예요.
export const HOME_SUMMARY_FIXTURE: HomeSummary = {
  account: {
    evaluationAmount: 12_480_000,
    orderableAmount: 3_215_400,
    holdingSymbolCount: 6,
    syncedAt: '2026-10-29T14:32:05+09:00',
  },
  todayPnl: { amount: 81_842, rate: 0.66 },
  botCounts: { running: 2, paused: 1, waitingFunds: 1, stopped: 0 },
  bots: [
    {
      id: 'bot-a',
      name: '모멘텀 단타 A',
      type: 'day',
      status: 'running',
      stage: 'released',
      version: 3,
      todayPnl: 92_400,
      todayFills: 5,
      winRate30d: 0.58,
      budget: 3_000_000,
      budgetSetting: { type: 'ratio', value: 0.3 },
      last7Days: [-8_000, 21_000, 12_500, 40_200, 31_000, 55_800, 48_300],
    },
    {
      id: 'bot-b',
      name: '종가 베팅 B',
      type: 'closing',
      status: 'running',
      stage: 'verifying',
      version: 1,
      todayPnl: 1_742,
      todayFills: 1,
      winRate30d: 0.64,
      budget: 100_000,
      budgetSetting: { type: 'fixed', value: 2_000_000 },
      last7Days: [-600, 300, -200, 900, 700, 1_300, 1_100],
    },
    {
      id: 'bot-c',
      name: '스윙 추세 C',
      type: 'swing',
      status: 'paused',
      stage: 'released',
      version: 2,
      todayPnl: -12_300,
      todayFills: 0,
      winRate30d: 0.52,
      budget: 2_500_000,
      budgetSetting: { type: 'fixed', value: 2_500_000 },
      last7Days: [18_000, 12_000, 15_500, 4_000, 6_200, -9_800, -15_400],
    },
    {
      id: 'bot-d',
      name: '스캘핑 D',
      type: 'scalping',
      status: 'waiting_funds',
      stage: 'verifying',
      version: 1,
      todayPnl: 0,
      todayFills: 0,
      winRate30d: null,
      budget: null,
      budgetSetting: { type: 'fixed', value: 1_500_000 },
      last7Days: [],
    },
  ],
  fills: { total: 12, buy: 7, sell: 5 },
};

export const homeHandlers = [
  http.get(mockApiUrl('/v1/home'), () =>
    HttpResponse.json(HOME_SUMMARY_FIXTURE),
  ),
];
