import { http, HttpResponse } from 'msw';

import { mockApiUrl } from '@/shared/api';

import type { BotListItem } from '../model/bot.schema';
import type { BotDailyResult, BotDetail } from '../model/bot-detail.schema';
import { BOTS_FIXTURE } from './bot.mock';

type SettingsExtra = Pick<
  BotDetail,
  'pendingVersion' | 'notRestingReasons' | 'settings'
>;
type DetailExtra = Omit<BotDetail, keyof BotListItem | keyof SettingsExtra>;

// 종가 베팅 규칙 값 칸 (Figma Bot Settings / 규칙 값 바꾸기)
const FIELDS_CLOSING: BotDetail['ruleVersion']['fields'] = [
  {
    key: 'dayRise',
    group: 'filter',
    label: '당일 상승률 하한',
    kind: 'number',
    unit: '%',
    value: 5,
  },
  {
    key: 'highGap',
    group: 'filter',
    label: '고가 대비 위치',
    kind: 'number',
    unit: '%',
    value: 2,
  },
  {
    key: 'entryStart',
    group: 'entry',
    label: '진입 시작',
    kind: 'time',
    unit: null,
    value: '15:10',
  },
  {
    key: 'entryEnd',
    group: 'entry',
    label: '진입 끝',
    kind: 'time',
    unit: null,
    value: '15:19',
  },
  {
    key: 'sellAt',
    group: 'exit',
    label: '다음 날 매도 시각',
    kind: 'time',
    unit: null,
    value: '09:05',
  },
  {
    key: 'gapStop',
    group: 'exit',
    label: '갭 하락 손절',
    kind: 'number',
    unit: '%',
    value: -2,
  },
  {
    key: 'firstLossPct',
    group: 'safety',
    label: '1회 손실 한도',
    kind: 'number',
    unit: '%',
    value: -3,
  },
  {
    key: 'totalLossPct',
    group: 'safety',
    label: '누적 손실 한도',
    kind: 'number',
    unit: '%',
    value: -10,
  },
  {
    key: 'stopStreak',
    group: 'safety',
    label: '연속 손절 횟수',
    kind: 'number',
    unit: null,
    value: 3,
  },
  {
    key: 'orderAmount',
    group: 'safety',
    label: '1회 주문 금액',
    kind: 'number',
    unit: '원',
    value: 100_000,
  },
];

const SETTINGS_DEFAULT: SettingsExtra = {
  pendingVersion: null,
  notRestingReasons: [],
  settings: {
    periodEnd: '2026-12-31',
    onPeriodEnd: 'liquidate',
    startPriority: null,
    orderAmount: 100_000,
  },
};

// 보유 종목이 있는 봇은 쉬는 중이 아니에요. bot-b는 정액이라 시작 우선순위가 있어요
const SETTINGS_EXTRAS: Record<string, Partial<SettingsExtra>> = {
  'bot-a': { notRestingReasons: ['holding'] },
  'bot-b': { settings: { ...SETTINGS_DEFAULT.settings, startPriority: 2 } },
  'bot-c': { notRestingReasons: ['holding'] },
};

const CRITERIA_B: BotDetail['releaseCriteria'] = [
  { key: 'period', value: 20, threshold: 10, passed: true },
  { key: 'closed_trades', value: 18, threshold: 30, passed: false },
  { key: 'net_pnl', value: 6_840, threshold: 0, passed: true },
  { key: 'profit_factor', value: 1.32, threshold: 1.5, passed: false },
  { key: 'mdd', value: 2.1, threshold: 5, passed: true },
];

const CRITERIA_NOT_STARTED: BotDetail['releaseCriteria'] = [
  { key: 'period', value: 0, threshold: 10, passed: false },
  { key: 'closed_trades', value: 0, threshold: 30, passed: false },
  { key: 'net_pnl', value: 0, threshold: 0, passed: false },
  { key: 'profit_factor', value: null, threshold: 1.5, passed: false },
  { key: 'mdd', value: 0, threshold: 5, passed: false },
];

const RULES_CLOSING = {
  version: 1,
  appliedAt: '2026-10-01T15:00:00+09:00',
  fields: FIELDS_CLOSING,
  values: [
    { label: '당일 상승률', display: '≥ 5%' },
    { label: '고가 대비 위치', display: '≤ 2%' },
    { label: '진입 시간', display: '15:10–15:19' },
    { label: '다음 날 매도', display: '09:05' },
    { label: '갭 하락 손절', display: '−2%' },
    { label: '손실 중지 1회 / 누적', display: '−3% / −10%' },
    { label: '연속 손절 횟수', display: '3' },
  ],
};

const FUNDS_B: NonNullable<BotDetail['funds']> = {
  allocatedAt: '2026-10-01T15:00:00+09:00',
  capitalAtAllocation: 3_215_400,
  usedAmount: 0,
  remainingBudget: 100_000,
  cashShare: 106_840,
  realizedPnl: 6_840,
  startPriority: 2,
  pendingReason: null,
};

// 시작 전·자금 대기 봇의 상세 값
const NOT_STARTED_EXTRA: DetailExtra = {
  startedAt: null,
  waitingSince: '2026-10-29T09:00:00+09:00',
  cumulativePnl: 0,
  cumulativePnlRate: 0,
  tradingDays: 0,
  lossStop: null,
  funds: null,
  releaseCriteria: CRITERIA_NOT_STARTED,
  ruleVersion: { ...RULES_CLOSING, values: RULES_CLOSING.values.slice(5) },
  holdings: [],
};

// 봇마다 목록 값에 더할 상세 값. 샘플은 Figma Bot Detail과 같은 숫자예요.
const DETAIL_EXTRAS: Record<string, DetailExtra> = {
  'bot-a': {
    startedAt: '2026-09-01T09:05:00+09:00',
    waitingSince: null,
    cumulativePnl: 412_800,
    cumulativePnlRate: 13.76,
    tradingDays: 41,
    lossStop: { remaining: 712_800, limitPercent: 10 },
    funds: {
      ...FUNDS_B,
      allocatedAt: '2026-10-02T15:40:00+09:00',
      usedAmount: 2_175_000,
      remainingBudget: 825_000,
      cashShare: 917_400,
      realizedPnl: 92_400,
      startPriority: null,
    },
    releaseCriteria: [],
    ruleVersion: {
      ...RULES_CLOSING,
      version: 3,
      values: RULES_CLOSING.values.slice(5),
    },
    holdings: [{ symbolName: '삼성전자', quantity: 30 }],
  },
  'bot-b': {
    startedAt: '2026-10-01T15:00:00+09:00',
    waitingSince: null,
    cumulativePnl: 6_840,
    cumulativePnlRate: 6.84,
    tradingDays: 20,
    lossStop: { remaining: 16_840, limitPercent: 10 },
    funds: FUNDS_B,
    releaseCriteria: CRITERIA_B,
    ruleVersion: RULES_CLOSING,
    holdings: [],
  },
  'bot-c': {
    startedAt: '2026-08-18T09:05:00+09:00',
    waitingSince: null,
    cumulativePnl: -48_600,
    cumulativePnlRate: -1.94,
    tradingDays: 52,
    lossStop: { remaining: 201_400, limitPercent: 10 },
    funds: {
      ...FUNDS_B,
      allocatedAt: '2026-09-24T15:40:00+09:00',
      capitalAtAllocation: 9_800_000,
      usedAmount: 2_616_200,
      remainingBudget: 0,
      cashShare: -116_200,
      realizedPnl: -48_600,
      startPriority: 1,
    },
    releaseCriteria: [],
    ruleVersion: {
      ...RULES_CLOSING,
      version: 2,
      values: RULES_CLOSING.values.slice(5),
    },
    holdings: [
      { symbolName: 'NAVER', quantity: 8 },
      { symbolName: '현대차', quantity: 5 },
    ],
  },
  'bot-d': NOT_STARTED_EXTRA,
  'bot-e': {
    startedAt: '2026-09-29T09:05:00+09:00',
    waitingSince: null,
    cumulativePnl: -100_000,
    cumulativePnlRate: -10,
    tradingDays: 17,
    lossStop: null,
    funds: null,
    releaseCriteria: CRITERIA_NOT_STARTED,
    ruleVersion: {
      ...RULES_CLOSING,
      version: 2,
      values: RULES_CLOSING.values.slice(5),
    },
    holdings: [],
  },
};

export const BOT_DETAILS_FIXTURE: BotDetail[] = BOTS_FIXTURE.map((bot) => ({
  ...bot,
  ...SETTINGS_DEFAULT,
  ...(DETAIL_EXTRAS[bot.id] ?? NOT_STARTED_EXTRA),
  ...SETTINGS_EXTRAS[bot.id],
}));

const SAMPLE_PNL: [string, number][] = [
  ['2026-10-01', 48_000],
  ['2026-10-02', -16_000],
  ['2026-10-05', 72_000],
  ['2026-10-06', 9_500],
  ['2026-10-07', -38_000],
  ['2026-10-08', 98_000],
  ['2026-10-12', 24_000],
  ['2026-10-13', -6_000],
  ['2026-10-14', 61_000],
  ['2026-10-15', 79_000],
  ['2026-10-16', -27_000],
  ['2026-10-19', 18_000],
  ['2026-10-20', 41_000],
  ['2026-10-21', -64_000],
  ['2026-10-22', 22_000],
  ['2026-10-23', 112_000],
  ['2026-10-26', -12_000],
  ['2026-10-27', 54_000],
  ['2026-10-28', 66_000],
];

// 봇마다 크기만 다르게 한 일별 손익. 자금 대기 봇은 기록이 없어요.
const DAILY_SCALE: Record<string, number> = {
  'bot-a': 1,
  'bot-b': 0.02,
  'bot-c': 0.3,
  'bot-e': 0.2,
};

export function getBotDailyFixture(botId: string): BotDailyResult[] {
  const scale = DAILY_SCALE[botId];
  if (scale === undefined) return [];
  return SAMPLE_PNL.map(([tradeDate, pnl]) => ({
    tradeDate,
    pnl: Math.round(pnl * scale),
    verifying: botId === 'bot-b' || botId === 'bot-e',
  }));
}

export const botDetailHandlers = [
  http.get(mockApiUrl('/v1/bots/:id/daily-results'), ({ params, request }) => {
    const from = new URL(request.url).searchParams.get('from') ?? '';
    const items = getBotDailyFixture(String(params.id)).filter(
      (item) => item.tradeDate >= from,
    );
    return HttpResponse.json({ items });
  }),
  http.post(mockApiUrl('/v1/bots/:id/release'), ({ params }) =>
    HttpResponse.json({ id: params.id, stage: 'released' }),
  ),
  http.get(mockApiUrl('/v1/bots/:id'), ({ params }) => {
    const detail = BOT_DETAILS_FIXTURE.find((bot) => bot.id === params.id);
    if (!detail) {
      return HttpResponse.json({ code: 'BOT_NOT_FOUND' }, { status: 404 });
    }
    return HttpResponse.json(detail);
  }),
];
