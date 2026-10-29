// 막대 축의 끝값. 가장 큰 손익(절댓값)을 10만 원 단위로 올려요. 기록이 모두 0이어도 10만이에요.
const AXIS_STEP = 100_000;

export function getAxisMax(values: number[]) {
  const largest = Math.max(0, ...values.map((value) => Math.abs(value)));
  return Math.max(AXIS_STEP, Math.ceil(largest / AXIS_STEP) * AXIS_STEP);
}
