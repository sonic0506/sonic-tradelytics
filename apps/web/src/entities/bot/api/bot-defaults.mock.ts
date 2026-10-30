import { http, HttpResponse } from 'msw';

import { type BotType, botTypeSchema, mockApiUrl } from '@/shared/api';

import { riskProfileSchema } from '../model/bot.schema';
import type { BotDefaults, RuleField } from '../model/bot-defaults.schema';
import { LOSS_STOP_PRESET } from '../model/bot-type-traits';

// 유형별 규칙 기본값 (F1 "유형별 규칙" 표). 종가 베팅은 Figma Bot Create / 3 규칙 값과 같아요.
const RULES: Record<BotType, RuleField[]> = {
  scalping: [
    {
      key: 'turnoverRank',
      group: 'filter',
      label: '거래대금 순위',
      kind: 'number',
      unit: '위',
      value: 30,
    },
    {
      key: 'priceMin',
      group: 'filter',
      label: '주가 하한',
      kind: 'number',
      unit: '원',
      value: 2_000,
    },
    {
      key: 'volumeSurge',
      group: 'entry',
      label: '거래량 급증 배수',
      kind: 'number',
      unit: '배',
      value: 3,
    },
    {
      key: 'breakoutMinutes',
      group: 'entry',
      label: '직전 고점 기준',
      kind: 'number',
      unit: '분',
      value: 5,
    },
    {
      key: 'takeProfit',
      group: 'exit',
      label: '익절',
      kind: 'number',
      unit: '%',
      value: 1.5,
    },
    {
      key: 'maxHoldMinutes',
      group: 'exit',
      label: '최대 보유',
      kind: 'number',
      unit: '분',
      value: 10,
    },
  ],
  day: [
    {
      key: 'turnoverSurge',
      group: 'filter',
      label: '거래대금 급증 배수',
      kind: 'number',
      unit: '배',
      value: 2,
    },
    {
      key: 'openRise',
      group: 'filter',
      label: '시가 대비 상승률 하한',
      kind: 'number',
      unit: '%',
      value: 2,
    },
    {
      key: 'vwapBars',
      group: 'entry',
      label: 'VWAP 지지 확인 봉 수',
      kind: 'number',
      unit: '개',
      value: 3,
    },
    {
      key: 'partialTakeProfit',
      group: 'exit',
      label: '분할 익절',
      kind: 'number',
      unit: '%',
      value: 3,
    },
    {
      key: 'closeBy',
      group: 'exit',
      label: '장 마감 전 청산 시각',
      kind: 'time',
      unit: null,
      value: '15:10',
    },
  ],
  swing: [
    {
      key: 'marketCapMin',
      group: 'filter',
      label: '시가총액 하한',
      kind: 'number',
      unit: '억 원',
      value: 3_000,
    },
    {
      key: 'ma20Gap',
      group: 'entry',
      label: '20일선 거리',
      kind: 'number',
      unit: '%',
      value: 2,
    },
    {
      key: 'rsiRebound',
      group: 'entry',
      label: 'RSI 반등 기준',
      kind: 'number',
      unit: null,
      value: 35,
    },
    {
      key: 'targetPct',
      group: 'exit',
      label: '목표 수익률',
      kind: 'number',
      unit: '%',
      value: 8,
    },
    {
      key: 'maxHoldDays',
      group: 'exit',
      label: '최대 보유',
      kind: 'number',
      unit: '일',
      value: 10,
    },
  ],
  closing: [
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
      value: 3,
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
  ],
};

const TRADING_HOURS: Record<BotType, BotDefaults['tradingHours']> = {
  scalping: { start: '09:05', end: '15:15' },
  day: { start: '09:05', end: '15:15' },
  swing: { start: '09:30', end: '15:20' },
  closing: { start: '15:10', end: '15:20' },
};

const PROFILE_SIZING = {
  aggressive: { maxPositions: 3, stopStreak: 4 },
  neutral: { maxPositions: 2, stopStreak: 3 },
  conservative: { maxPositions: 1, stopStreak: 2 },
};

export const botDefaultsHandlers = [
  http.get(mockApiUrl('/v1/bot-defaults'), ({ request }) => {
    const query = new URL(request.url).searchParams;
    const type = botTypeSchema.safeParse(query.get('type')).data;
    const riskProfile = riskProfileSchema.safeParse(
      query.get('riskProfile'),
    ).data;
    if (!type || !riskProfile) {
      return HttpResponse.json({ code: 'VALIDATION_FAILED' }, { status: 400 });
    }
    const body: BotDefaults = {
      capAmount: 100_000,
      budget: { type: 'ratio', value: 0.1 },
      orderAmount: 100_000,
      splitCount: 1,
      maxPositions: PROFILE_SIZING[riskProfile].maxPositions,
      tradingHours: TRADING_HOURS[type],
      rules: RULES[type],
      lossStop: LOSS_STOP_PRESET[type][riskProfile],
      stopStreak: PROFILE_SIZING[riskProfile].stopStreak,
      onDailyLimit: 'liquidate',
    };
    return HttpResponse.json(body);
  }),
];
