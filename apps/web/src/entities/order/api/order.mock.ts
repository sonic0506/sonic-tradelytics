import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { FilledOrder } from '../model/order.schema';

export const FILLED_ORDERS_FIXTURE: FilledOrder[] = [
  [
    'ord-5',
    '14:21:08',
    '005930',
    '삼성전자',
    '모멘텀 단타 A',
    'SELL',
    10,
    72_500,
  ],
  [
    'ord-4',
    '13:58:40',
    '005930',
    '삼성전자',
    '모멘텀 단타 A',
    'BUY',
    5,
    72_300,
  ],
  ['ord-3', '11:02:15', '035420', 'NAVER', '스윙 추세 C', 'BUY', 5, 176_400],
  [
    'ord-2',
    '10:28:31',
    '035720',
    '카카오',
    '모멘텀 단타 A',
    'SELL',
    20,
    43_200,
  ],
  ['ord-1', '09:05:02', '042660', '한화오션', '종가 베팅 B', 'SELL', 3, 31_850],
].map(
  ([
    id,
    time,
    symbolCode,
    symbolName,
    botName,
    side,
    filledQuantity,
    avgFillPrice,
  ]) => ({
    id: String(id),
    filledAt: `2026-10-29T${String(time)}+09:00`,
    symbolCode: String(symbolCode),
    symbolName: String(symbolName),
    botName: String(botName),
    side: side === 'BUY' ? 'BUY' : 'SELL',
    filledQuantity: Number(filledQuantity),
    avgFillPrice: Number(avgFillPrice),
    origin: 'bot',
    positionId: `pos-of-${String(id)}`,
  }),
);

export const orderHandlers = [
  http.get(mockApiUrl('/v1/orders'), () =>
    HttpResponse.json({
      items: FILLED_ORDERS_FIXTURE,
      meta: { page: 1, size: 5, total: 12 },
    }),
  ),
];
