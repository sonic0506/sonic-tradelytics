import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { BotStat } from '../model/bot-stat.schema';

// Figma Compare / 정상과 같은 숫자예요.
export const BOT_STATS_FIXTURE: BotStat[] = [
  {
    botId: 'bot-a',
    name: '모멘텀 단타 A',
    stage: 'released',
    returnRate: 8.42,
    netPnl: 252_600,
    winRate: 0.58,
    profitFactor: 1.84,
    mdd: 3.2,
    avgHoldMinutes: 47,
    tradeCount: 62,
    cost: 48_300,
  },
  {
    botId: 'bot-b',
    name: '종가 베팅 B',
    stage: 'verifying',
    returnRate: 6.84,
    netPnl: 6_840,
    winRate: 0.61,
    profitFactor: 1.32,
    mdd: 2.1,
    avgHoldMinutes: 1_060,
    tradeCount: 18,
    cost: 2_610,
  },
  {
    botId: null,
    name: '직접 거래',
    stage: null,
    returnRate: 2.4,
    netPnl: 41_500,
    winRate: 0.5,
    profitFactor: 1.1,
    mdd: 4.9,
    avgHoldMinutes: 8_928,
    tradeCount: 8,
    cost: 9_800,
  },
  {
    botId: 'bot-c',
    name: '스윙 추세 C',
    stage: 'released',
    returnRate: -1.92,
    netPnl: -48_000,
    winRate: 0.44,
    profitFactor: 1.21,
    mdd: 6.8,
    avgHoldMinutes: 4_896,
    tradeCount: 9,
    cost: 7_900,
  },
  {
    botId: 'bot-e',
    name: '단타 실험 E',
    stage: 'verifying',
    returnRate: -15,
    netPnl: -15_000,
    winRate: 0.38,
    profitFactor: 0.71,
    mdd: 15,
    avgHoldMinutes: 22,
    tradeCount: 24,
    cost: 3_100,
  },
  {
    botId: 'bot-d',
    name: '스캘핑 D',
    stage: 'verifying',
    returnRate: null,
    netPnl: null,
    winRate: null,
    profitFactor: null,
    mdd: null,
    avgHoldMinutes: null,
    tradeCount: 0,
    cost: 0,
  },
];

export const botStatHandlers = [
  http.get(mockApiUrl('/v1/bot-stats'), () =>
    HttpResponse.json({
      items: BOT_STATS_FIXTURE,
      benchmark: { kospi: 3.1, kosdaq: -1.4 },
    }),
  ),
];
