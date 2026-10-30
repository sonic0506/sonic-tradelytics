import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { ClosedPosition, Holding } from '../model/position.schema';

const QUOTED_AT = '2026-10-29T14:32:05+09:00';

export const HOLDINGS_FIXTURE: Holding[] = [
  [
    'pos-1',
    '005930',
    '삼성전자',
    '모멘텀 단타 A',
    30,
    71_200,
    72_500,
    2_175_000,
    39_000,
    1.83,
  ],
  [
    'pos-2',
    '000660',
    'SK하이닉스',
    null,
    6,
    195_500,
    198_000,
    1_188_000,
    15_000,
    1.28,
  ],
  [
    'pos-3',
    '035420',
    'NAVER',
    '스윙 추세 C',
    8,
    181_000,
    176_400,
    1_411_200,
    -36_800,
    -2.54,
  ],
  [
    'pos-4',
    '005380',
    '현대차',
    '스윙 추세 C',
    5,
    238_000,
    241_000,
    1_205_000,
    15_000,
    1.26,
  ],
  [
    'pos-5',
    '035720',
    '카카오',
    null,
    40,
    44_100,
    43_200,
    1_728_000,
    -36_000,
    -2.04,
  ],
  [
    'pos-6',
    '373220',
    'LG에너지솔루션',
    null,
    4,
    352_000,
    356_500,
    1_426_000,
    18_000,
    1.28,
  ],
].map(
  ([
    id,
    symbolCode,
    symbolName,
    botName,
    quantity,
    avgPrice,
    currentPrice,
    evaluationAmount,
    unrealizedPnl,
    unrealizedPnlRate,
  ]) => ({
    id: String(id),
    symbolCode: String(symbolCode),
    symbolName: String(symbolName),
    botName: botName === null ? null : String(botName),
    quantity: Number(quantity),
    avgPrice: Number(avgPrice),
    currentPrice: Number(currentPrice),
    evaluationAmount: Number(evaluationAmount),
    unrealizedPnl: Number(unrealizedPnl),
    unrealizedPnlRate: Number(unrealizedPnlRate),
    quotedAt: QUOTED_AT,
  }),
);

// 종가 베팅 B의 최근 청산 (Figma Bot Detail 최근 거래). 다른 봇도 같은 줄을 써요.
export const CLOSED_POSITIONS_FIXTURE: ClosedPosition[] = [
  [
    'cp-18',
    '10-28T15:18',
    '10-29T09:05',
    '한화오션',
    3,
    31_200,
    31_850,
    1_742,
    'time_exit',
  ],
  [
    'cp-17',
    '10-27T15:16',
    '10-28T09:05',
    'HD현대일렉트릭',
    1,
    98_400,
    97_100,
    -1_526,
    'stop_loss',
  ],
  [
    'cp-16',
    '10-24T15:17',
    '10-27T09:05',
    '삼양식품',
    1,
    96_500,
    99_200,
    2_409,
    'time_exit',
  ],
  [
    'cp-15',
    '10-23T15:19',
    '10-24T09:05',
    '에코프로비엠',
    2,
    41_300,
    41_450,
    86,
    'time_exit',
  ],
  [
    'cp-14',
    '10-22T15:15',
    '10-23T09:05',
    '한미반도체',
    1,
    88_700,
    87_900,
    -1_061,
    'stop_loss',
  ],
].map(
  ([
    id,
    entered,
    exited,
    symbolName,
    quantity,
    entryPrice,
    exitPrice,
    netPnl,
    exitReason,
  ]) => ({
    id: String(id),
    enteredAt: `2026-${String(entered)}:00+09:00`,
    exitedAt: `2026-${String(exited)}:00+09:00`,
    symbolName: String(symbolName),
    quantity: Number(quantity),
    entryPrice: Number(entryPrice),
    exitPrice: Number(exitPrice),
    netPnl: Number(netPnl),
    exitReason: exitReason === 'stop_loss' ? 'stop_loss' : 'time_exit',
  }),
);

// 청산이 아직 없는 봇
const NO_CLOSED_POSITION_BOTS = new Set(['bot-d']);

export const positionHandlers = [
  http.get(mockApiUrl('/v1/positions'), ({ request }) => {
    const params = new URL(request.url).searchParams;
    if (params.get('status') === 'closed') {
      const botId = params.get('botIds') ?? '';
      const items = NO_CLOSED_POSITION_BOTS.has(botId)
        ? []
        : CLOSED_POSITIONS_FIXTURE;
      return HttpResponse.json({
        items,
        meta: { page: 1, size: 5, total: items.length === 0 ? 0 : 18 },
      });
    }
    return HttpResponse.json({
      items: HOLDINGS_FIXTURE,
      meta: { page: 1, size: 100, total: HOLDINGS_FIXTURE.length },
    });
  }),
];
