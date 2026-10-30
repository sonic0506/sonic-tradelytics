import type { BotType } from '@/shared/api';

import type { RiskProfile } from './bot.schema';

// 밤을 넘겨 들고 있는 유형이면 갭 하락 위험을 안내해요 (FR-BOT-07)
export const IS_CARRY_OVER: Record<BotType, boolean> = {
  scalping: false,
  day: false,
  swing: true,
  closing: true,
};

// 첫 번째 손실 한도를 세는 단위. 스윙은 종목당, 종가 베팅은 1회 진입당이에요 (POL-RISK-01)
export const LOSS_SCOPE_LABEL: Record<BotType, string> = {
  scalping: '하루',
  day: '하루',
  swing: '종목당',
  closing: '1회',
};

// 성향별 손실 중지 % (POL-RISK-01 표). 성향을 고르기 전에 보여 주는 안내용이고,
// 폼에 채우는 값은 GET /v1/bot-defaults에서 받아요.
export const LOSS_STOP_PRESET: Record<
  BotType,
  Record<RiskProfile, { first: number; total: number }>
> = {
  scalping: {
    aggressive: { first: 5, total: 15 },
    neutral: { first: 3, total: 10 },
    conservative: { first: 2, total: 6 },
  },
  day: {
    aggressive: { first: 6, total: 15 },
    neutral: { first: 4, total: 10 },
    conservative: { first: 2, total: 6 },
  },
  swing: {
    aggressive: { first: 7, total: 15 },
    neutral: { first: 5, total: 10 },
    conservative: { first: 3, total: 5 },
  },
  closing: {
    aggressive: { first: 5, total: 15 },
    neutral: { first: 3, total: 10 },
    conservative: { first: 2, total: 6 },
  },
};
