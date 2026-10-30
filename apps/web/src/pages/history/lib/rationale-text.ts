import type { PositionScoring } from '@/entities/position';

export const DIRECTION_LABEL: Record<
  PositionScoring['actualDirection'],
  string
> = {
  up: '상승',
  down: '하락',
  flat: '변화 없음',
};

// 17시간 47분, 2일 3시간
export function formatHoldingTime(minutes: number) {
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const rest = minutes % 60;
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${rest}분`;
  return `${rest}분`;
}

// 예측 비율은 소수 첫째 자리까지: 1.9 → "+1.9%", -2 → "−2.0%"
export function formatRate(rate: number) {
  const sign = rate > 0 ? '+' : rate < 0 ? '−' : '';
  return `${sign}${Math.abs(rate).toFixed(1)}%`;
}
