import type { BotStatus, BotType } from '@/shared/api';

// 화면 문구는 Figma를 따라요(day → "단타").
export const BOT_TYPE_LABEL: Record<BotType, string> = {
  scalping: '스캘핑',
  day: '단타',
  swing: '스윙',
  closing: '종가 베팅',
};

export const BOT_STATUS_LABEL: Record<BotStatus, string> = {
  ready: '시작 대기',
  running: '실행 중',
  paused: '일시정지',
  waiting_funds: '자금 대기',
  stopped: '정지',
};

export const BOT_STATUS_TONE: Record<
  BotStatus,
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  ready: 'neutral',
  running: 'success',
  paused: 'warning',
  waiting_funds: 'neutral',
  stopped: 'danger',
};
