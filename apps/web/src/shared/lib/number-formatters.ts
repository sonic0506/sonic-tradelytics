import { formatNumber } from '@xonic0506/sonic-ui';

// 음수 부호는 하이픈이 아니라 마이너스 기호(U+2212)예요. 고정폭 글꼴에서 + 와 너비가 같아요.
const MINUS = '−';

export function formatWon(value: number) {
  return `${formatNumber(value)}원`;
}

// 손익: 부호를 항상 붙이고 0은 부호 없이 써요(CLAUDE.md "손익 색").
export function formatSignedWon(value: number) {
  if (value === 0) return '0원';
  const sign = value > 0 ? '+' : MINUS;
  return `${sign}${formatNumber(Math.abs(value))}원`;
}

// 표 안 손익처럼 단위 없이 부호만 붙여요. 39000 → "+39,000"
export function formatSignedNumber(value: number) {
  if (value === 0) return '0';
  return `${value > 0 ? '+' : MINUS}${formatNumber(Math.abs(value))}`;
}

// 손익률(% 값). 소수 둘째 자리까지 써요.
export function formatSignedPercent(value: number) {
  const fixed = Math.abs(value).toFixed(2);
  if (Number(fixed) === 0) return '0.00%';
  return `${value > 0 ? '+' : MINUS}${fixed}%`;
}

// 0~1 비율을 정수 %로 써요. 0.58 → "58%"
export function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

// 차트 축처럼 짧게 써요. 200000 → "+20만", -200000 → "−20만"
export function formatSignedManWon(value: number) {
  if (value === 0) return '0';
  const man = Math.round(Math.abs(value) / 10_000);
  return `${value > 0 ? '+' : MINUS}${formatNumber(man)}만`;
}
