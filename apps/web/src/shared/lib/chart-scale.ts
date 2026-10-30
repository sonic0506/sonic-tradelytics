// 손익 막대 축의 끝값. 가장 큰 손익(절댓값)을 그 자릿수 단위로 올려요.
// 112,000 → 200,000 · 1,742 → 2,000. 모두 0이면 1,000으로 그려요.
const MIN_STEP = 1_000;

export function getAxisMax(values: number[]) {
  const largest = Math.max(0, ...values.map((value) => Math.abs(value)));
  if (largest === 0) return MIN_STEP;
  const step = Math.max(MIN_STEP, 10 ** Math.floor(Math.log10(largest)));
  return Math.ceil(largest / step) * step;
}
