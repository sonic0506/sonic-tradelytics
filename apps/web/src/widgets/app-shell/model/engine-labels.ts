import type { EngineHealth } from '@/entities/engine-status';

export const ENGINE_HEALTH_LABEL: Record<EngineHealth, string> = {
  running: '엔진 실행 중',
  halted: '엔진 정지',
  unresponsive: '엔진 응답 없음',
  feed_stale: '시세 끊김',
};

export const ENGINE_HEALTH_TONE: Record<
  EngineHealth,
  'success' | 'danger' | 'warning'
> = {
  running: 'success',
  halted: 'danger',
  unresponsive: 'warning',
  feed_stale: 'warning',
};

// 전체 정지 사유 코드(engine.md). 모르는 코드는 그대로 보여 줘요.
const HALT_REASON_LABEL: Record<string, string> = {
  kill_switch: '킬 스위치',
  token_failure: '토큰 오류',
  record_failure: '기록 실패',
};

export function getHaltReasonLabel(reasons: string[]) {
  const [first] = reasons;
  if (!first) return '사유 확인 필요';
  return HALT_REASON_LABEL[first] ?? first;
}
