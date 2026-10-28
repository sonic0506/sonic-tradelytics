// halted는 전체 정지 (킬 스위치·토큰·기록 실패)
export const ENGINE_STATES = ['running', 'stopping', 'halted'] as const;
export type EngineStateValue = (typeof ENGINE_STATES)[number];
