import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type {
  PositionOrder,
  PositionRow,
  PositionSummary,
} from '../model/position-history.schema';
import type {
  DecisionTimeline,
  EntryDecision,
  PositionOutcome,
  PositionScoring,
} from '../model/position-rationale.schema';

type Seed = [
  id: string,
  entered: string,
  exited: string | null,
  bot: 'bot-a' | 'bot-b' | 'bot-c' | null,
  code: string,
  name: string,
  quantity: number,
  entryPrice: number,
  secondPrice: number | null,
  netPnl: number,
  netPnlRate: number,
  status: PositionRow['status'],
  exitReason: PositionRow['exitReason'],
];

const BOTS = {
  'bot-a': { name: '모멘텀 단타 A', type: 'day' },
  'bot-b': { name: '종가 베팅 B', type: 'closing' },
  'bot-c': { name: '스윙 추세 C', type: 'swing' },
} as const;

// Figma History / 정상과 같은 거래예요. 보유 중 6건 + 그 밖의 거래
const SEEDS: Seed[] = [
  [
    'pos-1',
    '10-29T09:12',
    null,
    'bot-a',
    '005930',
    '삼성전자',
    30,
    71_200,
    72_500,
    39_000,
    1.83,
    'holding',
    null,
  ],
  [
    'pos-3',
    '10-24T11:02',
    null,
    'bot-c',
    '035420',
    'NAVER',
    8,
    181_000,
    176_400,
    -36_800,
    -2.54,
    'holding',
    null,
  ],
  [
    'pos-4',
    '10-22T09:03',
    null,
    'bot-c',
    '005380',
    '현대차',
    5,
    238_000,
    241_000,
    15_000,
    1.26,
    'holding',
    null,
  ],
  [
    'pos-2',
    '10-20T13:58',
    null,
    null,
    '000660',
    'SK하이닉스',
    6,
    195_500,
    198_000,
    15_000,
    1.28,
    'holding',
    null,
  ],
  [
    'pos-6',
    '10-17T14:05',
    null,
    null,
    '373220',
    'LG에너지솔루션',
    4,
    352_000,
    356_500,
    18_000,
    1.28,
    'holding',
    null,
  ],
  [
    'pos-5',
    '10-15T10:28',
    null,
    null,
    '035720',
    '카카오',
    40,
    44_100,
    43_200,
    -36_000,
    -2.04,
    'holding',
    null,
  ],
  [
    'pos-11',
    '10-29T14:28',
    null,
    'bot-a',
    '000270',
    '기아',
    15,
    98_200,
    null,
    0,
    0,
    'pending',
    null,
  ],
  [
    'pos-10',
    '10-29T10:05',
    '10-29T11:40',
    'bot-a',
    '068270',
    '셀트리온',
    10,
    182_300,
    191_500,
    90_214,
    4.95,
    'closed',
    'take_profit',
  ],
  [
    'pos-9',
    '10-29T09:40',
    null,
    'bot-a',
    '329180',
    'HD현대중공업',
    5,
    288_000,
    null,
    0,
    0,
    'canceled',
    null,
  ],
  [
    'cp-18',
    '10-28T15:18',
    '10-29T09:05',
    'bot-b',
    '042660',
    '한화오션',
    3,
    31_200,
    31_850,
    1_742,
    1.86,
    'closed',
    'time_exit',
  ],
  [
    'cp-17',
    '10-27T15:16',
    '10-28T09:02',
    'bot-b',
    '267260',
    'HD현대일렉트릭',
    1,
    98_400,
    97_100,
    -1_526,
    -1.55,
    'closed',
    'stop_loss',
  ],
  [
    'cp-16',
    '10-24T15:17',
    '10-27T09:05',
    'bot-b',
    '003230',
    '삼양식품',
    1,
    96_500,
    99_200,
    2_409,
    2.8,
    'closed',
    'time_exit',
  ],
  [
    'cp-15',
    '10-23T15:19',
    '10-24T09:05',
    'bot-b',
    '247540',
    '에코프로비엠',
    2,
    41_300,
    41_450,
    86,
    0.1,
    'closed',
    'time_exit',
  ],
  [
    'cp-14',
    '10-22T15:15',
    '10-23T09:01',
    'bot-b',
    '042700',
    '한미반도체',
    1,
    88_700,
    87_900,
    -1_061,
    -1.2,
    'closed',
    'stop_loss',
  ],
];

const toIso = (text: string) => `2026-${text}:00+09:00`;

export const POSITION_HISTORY_FIXTURE: PositionRow[] = SEEDS.map(
  ([
    id,
    entered,
    exited,
    bot,
    code,
    name,
    quantity,
    entryPrice,
    second,
    netPnl,
    netPnlRate,
    status,
    exitReason,
  ]) => ({
    id,
    enteredAt: toIso(entered),
    exitedAt: exited ? toIso(exited) : null,
    botId: bot,
    botName: bot ? BOTS[bot].name : null,
    botType: bot ? BOTS[bot].type : null,
    symbolCode: code,
    symbolName: name,
    quantity,
    entryPrice,
    exitPrice: status === 'closed' ? second : null,
    currentPrice: status === 'holding' ? second : null,
    netPnl,
    netPnlRate,
    status,
    exitReason,
  }),
);

function filterRows(query: URLSearchParams) {
  const botIds = query.get('botIds')?.split(',').filter(Boolean) ?? [];
  const symbol = query.get('symbol') ?? '';
  const from = query.get('from');
  const to = query.get('to');
  return POSITION_HISTORY_FIXTURE.filter((row) => {
    const day = row.enteredAt.slice(0, 10);
    if (botIds.length > 0 && !botIds.includes(row.botId ?? 'manual'))
      return false;
    if (
      symbol &&
      !row.symbolCode.includes(symbol) &&
      !row.symbolName.includes(symbol)
    )
      return false;
    if (query.get('result') === 'profit' && row.netPnl <= 0) return false;
    if (query.get('result') === 'loss' && row.netPnl >= 0) return false;
    if (query.get('status') && row.status !== query.get('status')) return false;
    if (query.get('exitReasons') && row.exitReason !== query.get('exitReasons'))
      return false;
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  });
}

function getSummary(
  query: URLSearchParams,
  rows: PositionRow[],
): PositionSummary {
  const botIds = query.get('botIds')?.split(',').filter(Boolean) ?? [];
  if (botIds.length === 1 && botIds[0] === 'bot-b') {
    return {
      kind: 'bot',
      budget: 100_000,
      usedAmount: 0,
      remainingBudget: 100_000,
      capAmount: 100_000,
      cumulativePnl: 6_840,
      cumulativePnlRate: 6.84,
      tradingDays: 20,
      lossStopRemaining: 16_840,
      lossLimitPercent: 10,
    };
  }
  const pnlByBot = new Map<
    string,
    { botId: string | null; name: string; pnl: number }
  >();
  for (const row of rows) {
    const key = row.botId ?? 'manual';
    const current = pnlByBot.get(key) ?? {
      botId: row.botId,
      name: row.botName ?? '직접 거래',
      pnl: 0,
    };
    pnlByBot.set(key, { ...current, pnl: current.pnl + row.netPnl });
  }
  const unrealizedPnl = rows
    .filter((row) => row.status === 'holding')
    .reduce((sum, row) => sum + row.netPnl, 0);
  return {
    kind: 'overall',
    tradeCount: rows.length,
    holdingCount: rows.filter((row) => row.status === 'holding').length,
    closedCount: rows.filter((row) => row.status === 'closed').length,
    netPnl: rows.reduce((sum, row) => sum + row.netPnl, 0),
    unrealizedPnl,
    cost: 1_982,
    tax: 1_570,
    botPnls: [...pnlByBot.values()].sort((a, b) => b.pnl - a.pnl).slice(0, 4),
  };
}

function getOrders(row: PositionRow): PositionOrder[] {
  const base = {
    commission: 10,
    tax: 0,
    origin: row.botId ? 'bot' : 'manual',
  } as const;
  const buy: PositionOrder = {
    ...base,
    id: `${row.id}-buy`,
    side: 'BUY',
    kind: 'normal',
    orderedAt: row.enteredAt,
    quantity: row.quantity,
    avgPrice:
      row.status === 'pending' || row.status === 'canceled'
        ? null
        : row.entryPrice,
    status:
      row.status === 'pending'
        ? 'pending'
        : row.status === 'canceled'
          ? 'canceled'
          : 'filled',
    statusAt: row.status === 'canceled' ? row.enteredAt : null,
  };
  if (row.status !== 'closed' || !row.exitedAt) return [buy];
  const stop: PositionOrder = {
    ...base,
    id: `${row.id}-stop`,
    side: 'SELL',
    kind: 'stop_condition',
    orderedAt: row.enteredAt,
    quantity: row.quantity,
    avgPrice: Math.round(row.entryPrice * 0.98),
    commission: 0,
    status: 'canceled',
    statusAt: row.exitedAt,
    origin: 'protective',
  };
  const sell: PositionOrder = {
    ...base,
    id: `${row.id}-sell`,
    side: 'SELL',
    kind: 'normal',
    orderedAt: row.exitedAt,
    quantity: row.quantity,
    avgPrice: row.exitPrice,
    tax: Math.round((row.exitPrice ?? 0) * row.quantity * 0.002),
    status: 'filled',
    statusAt: row.exitedAt,
  };
  return [buy, stop, sell];
}

const roundTen = (value: number) => Math.round(value / 10) * 10;
const addMinutes = (iso: string, minutes: number) =>
  new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();

// 종가 베팅 판단 근거 (Figma Rationale / 정상 — 한화오션). 다른 거래도 같은 모양으로 만들어요
function getEntry(row: PositionRow): EntryDecision {
  const targetPrice = Math.round((row.entryPrice * 1.019) / 100) * 100;
  const stopPrice = roundTen(row.entryPrice * 0.98);
  return {
    decidedAt: addMinutes(row.enteredAt, 0.07),
    price: row.entryPrice,
    score: 78,
    conditions: [
      {
        label: '당일 상승률',
        rule: '기준 5% 이상',
        value: '6.2%',
        passed: true,
      },
      {
        label: '고가 대비 위치',
        rule: '기준 2% 이내',
        value: '0.8%',
        passed: true,
      },
      {
        label: '진입 시간',
        rule: '기준 15:10–15:19',
        value: '15:18',
        passed: true,
      },
      {
        label: '거래대금 순위',
        rule: '기준 30위 이내',
        value: '12위',
        passed: true,
      },
      {
        label: '거래대금 증가',
        rule: '기준 1.5배 이상 · 가중치가 낮아 진입',
        value: '1.4배',
        passed: false,
      },
    ],
    prediction: {
      direction: 'up',
      targetPrice,
      targetRate:
        Math.round(((targetPrice - row.entryPrice) / row.entryPrice) * 1_000) /
        10,
      stopPrice,
      stopRate:
        Math.round(((stopPrice - row.entryPrice) / row.entryPrice) * 1_000) /
        10,
      holdUntil: '다음 날 09:05까지',
    },
  };
}

function getOutcome(row: PositionRow, entry: EntryDecision) {
  if (row.status !== 'closed' || !row.exitedAt || row.exitPrice === null) {
    return { outcome: null, scoring: null };
  }
  const exitPrice = row.exitPrice;
  const highPrice =
    Math.round((Math.max(exitPrice, row.entryPrice) * 1.0016) / 50) * 50;
  const outcome: PositionOutcome = {
    exitPrice,
    holdingMinutes: Math.round(
      (new Date(row.exitedAt).getTime() - new Date(row.enteredAt).getTime()) /
        60_000,
    ),
    highPrice,
    highAt: addMinutes(row.exitedAt, -3),
    lowPrice:
      Math.round((Math.min(exitPrice, row.entryPrice) * 0.995) / 50) * 50,
    lowAt: addMinutes(row.enteredAt, 7),
  };
  const { targetPrice } = entry.prediction;
  const actualDirection =
    exitPrice > row.entryPrice
      ? 'up'
      : exitPrice < row.entryPrice
        ? 'down'
        : 'flat';
  const scoring: PositionScoring = {
    directionHit: actualDirection === 'up',
    actualDirection,
    targetReachPct: Math.round(
      Math.min(
        100,
        Math.max(
          0,
          ((highPrice - row.entryPrice) / (targetPrice - row.entryPrice)) * 100,
        ),
      ),
    ),
    errorPct:
      Math.round(((exitPrice - targetPrice) / row.entryPrice) * 10_000) / 100,
  };
  return { outcome, scoring };
}

function getTimeline(row: PositionRow, entry: EntryDecision): DecisionTimeline {
  const { targetPrice, stopPrice } = entry.prediction;
  const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
  const timeline: DecisionTimeline = [
    {
      at: row.enteredAt,
      kind: 'enter',
      title: '진입 판단',
      detail: `점수 ${entry.score} · 목표가 ${won(targetPrice)} · 손절가 ${won(stopPrice)}`,
    },
  ];
  if (row.status !== 'holding' && row.status !== 'closed') return timeline;
  timeline.push({
    at: addMinutes(row.enteredAt, 17),
    kind: 'reeval',
    title: '장 마감 재평가 · 유지',
    detail: `점수 74 · 종가 ${won(roundTen(row.entryPrice * 1.0048))} · 목표가 ${won(targetPrice)} 유지`,
  });
  if (row.status !== 'closed' || !row.exitedAt || row.exitPrice === null)
    return timeline;
  timeline.push(
    {
      at: addMinutes(row.exitedAt, -10),
      kind: 'reeval',
      title: '장전 점검 · 유지',
      detail: `예상 시초가 ${won(roundTen(row.entryPrice * 1.008))} · 갭 하락 아님 · 손절가 ${won(stopPrice)} 유지`,
    },
    {
      at: row.exitedAt,
      kind: 'exit',
      title: '청산 판단 · 시간 청산',
      detail: `다음 날 매도 시각에 ${won(row.exitPrice)}으로 청산`,
    },
  );
  return timeline;
}

function getDetail(row: PositionRow) {
  const base = { id: row.id, position: row, orders: getOrders(row) };
  if (!row.botId) {
    return {
      ...base,
      botVersion: null,
      entry: null,
      outcome: null,
      scoring: null,
      timeline: [],
    };
  }
  const entry = getEntry(row);
  return {
    ...base,
    botVersion: 1,
    entry,
    ...getOutcome(row, entry),
    timeline: getTimeline(row, entry),
  };
}

// 투자 내역 요청(page가 있는 요청)만 받아요. 나머지는 positionHandlers로 넘겨요
export const positionHistoryHandlers = [
  http.get(mockApiUrl('/v1/positions'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    if (!query.has('page')) return undefined;
    const page = Number(query.get('page') ?? 1);
    const size = Number(query.get('size') ?? 20);
    const rows = filterRows(query);
    const holdings = rows.filter((row) => row.status === 'holding');
    const others = rows.filter((row) => row.status !== 'holding');
    const pageRows = others.slice((page - 1) * size, page * size);
    return HttpResponse.json({
      items: page === 1 ? [...holdings, ...pageRows] : pageRows,
      meta: { page, size, total: others.length },
      quotedAt: holdings.length > 0 ? '2026-10-29T14:32:05+09:00' : null,
    });
  }),
  http.get(mockApiUrl('/v1/position-summaries'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    return HttpResponse.json(getSummary(query, filterRows(query)));
  }),
  http.get(mockApiUrl('/v1/positions/:id'), ({ params }) => {
    const row = POSITION_HISTORY_FIXTURE.find((item) => item.id === params.id);
    if (!row) {
      return HttpResponse.json({ code: 'POSITION_NOT_FOUND' }, { status: 404 });
    }
    return HttpResponse.json(getDetail(row));
  }),
];
