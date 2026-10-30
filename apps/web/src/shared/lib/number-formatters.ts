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

// MDD·한도처럼 항상 음수로 읽는 % 값. 2.1 → "−2.1%"
export function formatNegativePercent(value: number, digits = 1) {
  return `${MINUS}${Math.abs(value).toFixed(digits)}%`;
}

// 0~1 비율을 정수 %로 써요. 0.58 → "58%"
export function formatRatio(value: number) {
  return `${Math.round(value * 100)}%`;
}

// 상한처럼 만 원 단위로 떨어지는 금액. 100000 → "10만 원"
export function formatManWon(value: number) {
  return `${formatNumber(value / 10_000)}만 원`;
}

// 차트 축처럼 짧게 써요. 200000 → "+20만", 2000 → "+2천", 0 → "0"
export function formatSignedShortWon(value: number) {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  const text =
    abs >= 10_000
      ? `${formatNumber(abs / 10_000)}만`
      : `${formatNumber(abs / 1_000)}천`;
  return `${value > 0 ? '+' : MINUS}${text}`;
}
