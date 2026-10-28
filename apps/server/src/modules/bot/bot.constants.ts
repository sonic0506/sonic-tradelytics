// 값 목록은 docs/architecture/data-model.md의 CHECK와 같아요.
export const BOT_TYPES = [
  'scalping',
  'day_trading',
  'swing',
  'closing_bet',
] as const;
export type BotType = (typeof BOT_TYPES)[number];

export const RISK_PROFILES = ['aggressive', 'neutral', 'conservative'] as const;
export type RiskProfile = (typeof RISK_PROFILES)[number];

// 검증 구간 (POL-RISK-13)
export const BOT_STAGES = ['verifying', 'released'] as const;
export type BotStage = (typeof BOT_STAGES)[number];

export const BOT_STATUSES = [
  'ready',
  'running',
  'paused',
  'waiting_funds',
  'stopped',
] as const;
export type BotStatus = (typeof BOT_STATUSES)[number];

// 투자금·1회 주문 금액 방식: 정률·정액
export const AMOUNT_TYPES = ['ratio', 'fixed'] as const;
export type AmountType = (typeof AMOUNT_TYPES)[number];

// 운용 기간 종료(FR-BOT-08)·하루 한도 도달(POL-RISK-02) 시 보유분 처리
export const HOLDING_ACTIONS = ['liquidate', 'hold'] as const;
export type HoldingAction = (typeof HOLDING_ACTIONS)[number];

// decision_change면 검증 구간을 다시 시작해요 (FR-BOT-11)
export const VERSION_CHANGE_KINDS = [
  'initial',
  'decision_change',
  'risk_only',
] as const;
export type VersionChangeKind = (typeof VERSION_CHANGE_KINDS)[number];
