import type { BotType } from '@/shared/api';

// 봇 유형 카드 설명 (Figma Bot Create / 1 유형)
export const TYPE_DESCRIPTION: Record<BotType, string> = {
  scalping: '거래량이 갑자기 늘고 직전 고점을 넘으면 들어가 몇 분 안에 팔아요.',
  day: 'VWAP 지지를 확인하고 들어가 장 마감 전에 모두 팔아요.',
  swing: '20일선 근처에서 RSI가 반등하면 사서 며칠 들고 있어요.',
  closing: '마감 직전에 강한 종목을 사서 다음 날 아침에 팔아요.',
};

// 이월 유형의 갭 하락 안내 (FR-BOT-07)
export const GAP_RISK_NOTICE: Partial<Record<BotType, string>> = {
  swing:
    '스윙은 며칠씩 들고 있어요. 밤사이 악재가 나오면 시초가가 크게 떨어질 수 있고, 손절은 장이 열린 뒤에야 나가요.',
  closing:
    '종가 베팅은 다음 날까지 들고 있어요. 밤사이 악재가 나오면 시초가가 크게 떨어질 수 있고, 손절은 장이 열린 뒤에야 나가요.',
};

// 첫 번째 손실 한도에 닿으면 하는 일 (POL-RISK-01)
export const FIRST_LOSS_EFFECT: Record<BotType, string> = {
  scalping: '그날은 더 사지 않아요',
  day: '그날은 더 사지 않아요',
  swing: '그 종목을 팔아요',
  closing: '그 거래를 끝내요',
};
