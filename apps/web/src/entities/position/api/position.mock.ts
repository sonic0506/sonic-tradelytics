import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { Holding } from '../model/position.schema';

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

export const positionHandlers = [
  http.get(mockApiUrl('/v1/positions'), () =>
    HttpResponse.json({
      items: HOLDINGS_FIXTURE,
      meta: { page: 1, size: 100, total: HOLDINGS_FIXTURE.length },
    }),
  ),
];
