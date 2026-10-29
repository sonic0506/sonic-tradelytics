// halted는 전체 정지 (킬 스위치·토큰·기록 실패)
export const ENGINE_STATES = ['running', 'stopping', 'halted'] as const;
export type EngineStateValue = (typeof ENGINE_STATES)[number];

// 전체 신규 진입을 막는 이유 (docs/architecture/engine.md 정지 상태). stopping은 모든 주문을 막아요
export const HALT_REASONS = [
  'kill',
  'stopping',
  'token',
  'record_fail',
] as const;
export type HaltReason = (typeof HALT_REASONS)[number];
