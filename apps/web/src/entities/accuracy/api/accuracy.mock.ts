import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { AccuracyStats } from '../model/accuracy.schema';

// Figma Accuracy / 정상과 같은 숫자예요.
export const ACCURACY_STATS_FIXTURE: AccuracyStats = {
  summary: {
    scoredCount: 113,
    directionHitRate: 0.59,
    targetReachRate: 0.52,
    bots: [
      {
        botId: 'bot-a',
        name: '모멘텀 단타 A',
        scoredCount: 62,
        directionHitRate: 0.61,
        targetReachRate: 0.54,
        avgErrorPct: -0.42,
      },
      {
        botId: 'bot-b',
        name: '종가 베팅 B',
        scoredCount: 18,
        directionHitRate: 0.67,
        targetReachRate: 0.72,
        avgErrorPct: 0.18,
      },
      {
        botId: 'bot-c',
        name: '스윙 추세 C',
        scoredCount: 9,
        directionHitRate: 0.44,
        targetReachRate: 0.31,
        avgErrorPct: -1.25,
      },
      {
        botId: 'bot-e',
        name: '단타 실험 E',
        scoredCount: 24,
        directionHitRate: 0.42,
        targetReachRate: 0.28,
        avgErrorPct: -0.96,
      },
    ],
  },
  scoreBuckets: [
    { min: 90, max: 100, closedCount: 9, winRate: 0.78 },
    { min: 80, max: 89, closedCount: 21, winRate: 0.71 },
    { min: 70, max: 79, closedCount: 38, winRate: 0.58 },
    { min: 60, max: 69, closedCount: 26, winRate: 0.46 },
    { min: 0, max: 59, closedCount: 19, winRate: 0.31 },
  ],
  conditions: [
    {
      label: '거래량 급증 3배 이상',
      tradeCount: 48,
      winRate: 0.63,
      avgPnlRate: 0.62,
    },
    { label: '직전 고점 돌파', tradeCount: 52, winRate: 0.6, avgPnlRate: 0.48 },
    {
      label: '당일 상승률 5% 이상',
      tradeCount: 18,
      winRate: 0.61,
      avgPnlRate: 0.38,
    },
    { label: 'VWAP 지지', tradeCount: 31, winRate: 0.55, avgPnlRate: 0.21 },
    {
      label: '거래대금 증가 1.5배 이상',
      tradeCount: 12,
      winRate: 0.42,
      avgPnlRate: -0.15,
    },
  ],
  skipped: [
    { reason: 'entry_condition', count: 214, avgChangePct: 0.12 },
    { reason: 'market_alert', count: 11, avgChangePct: -1.1 },
    { reason: 'symbol_lock', count: 9, avgChangePct: 0.85 },
    { reason: 'risk', count: 6, avgChangePct: -0.4 },
    { reason: 'funds', count: 4, avgChangePct: 0.3 },
  ],
  reeval: {
    initialHitRate: 0.63,
    initialCount: 31,
    reevalHitRate: 0.71,
    reevalCount: 14,
  },
};

export const accuracyHandlers = [
  http.get(mockApiUrl('/v1/accuracy-stats'), ({ request }) => {
    const botIds =
      new URL(request.url).searchParams.get('botIds')?.split(',') ?? [];
    if (botIds.length === 0) return HttpResponse.json(ACCURACY_STATS_FIXTURE);
    const bots = ACCURACY_STATS_FIXTURE.summary.bots.filter((bot) =>
      botIds.includes(bot.botId),
    );
    return HttpResponse.json({
      ...ACCURACY_STATS_FIXTURE,
      summary: {
        ...ACCURACY_STATS_FIXTURE.summary,
        scoredCount: bots.reduce((sum, bot) => sum + bot.scoredCount, 0),
        bots,
      },
    });
  }),
];
