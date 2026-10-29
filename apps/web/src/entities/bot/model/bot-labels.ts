import type { BotStage, BotStatus, BotType } from '@/shared/api';

import type { RiskProfile } from './bot.schema';

// 용어는 docs/project/glossary.md를 따라요.
export const BOT_TYPE_LABEL: Record<BotType, string> = {
  scalping: '스캘핑',
  day: '데이 트레이딩',
  swing: '스윙',
  closing: '종가 베팅',
};

export const RISK_PROFILE_LABEL: Record<RiskProfile, string> = {
  aggressive: '공격적',
  neutral: '중립',
  conservative: '소극적',
};

export const BOT_STATUS_LABEL: Record<BotStatus, string> = {
  ready: '시작 대기',
  running: '실행 중',
  paused: '일시정지',
  waiting_funds: '자금 대기',
  stopped: '종료',
};

// Figma Bots / BotRow: 실행 중 success, 일시정지·자금 대기 warning, 시작 대기·종료 neutral
export const BOT_STATUS_TONE: Record<
  BotStatus,
  'neutral' | 'success' | 'warning' | 'danger'
> = {
  ready: 'neutral',
  running: 'success',
  paused: 'warning',
  waiting_funds: 'warning',
  stopped: 'neutral',
};

export const BOT_STAGE_LABEL: Record<BotStage, string> = {
  verifying: '검증 중',
  released: '상한 해제',
};
