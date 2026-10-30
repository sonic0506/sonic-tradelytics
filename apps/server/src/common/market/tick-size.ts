// KRX 호가 단위 (2023-01-25 개편, 코스피·코스닥 같아요). 가격이 below 미만이면 tick
const TICK_STEPS = [
  { below: 2_000, tick: 1 },
  { below: 5_000, tick: 5 },
  { below: 20_000, tick: 10 },
  { below: 50_000, tick: 50 },
  { below: 200_000, tick: 100 },
  { below: 500_000, tick: 500 },
];
const TOP_TICK = 1_000;

export function tickSize(price: number): number {
  return TICK_STEPS.find(({ below }) => price < below)?.tick ?? TOP_TICK;
}

// 호가 단위로 내림. 목표가·손절가처럼 주문에 쓸 가격을 맞춰요
export function floorToTick(price: number): number {
  const tick = tickSize(price);
  return Math.floor(price / tick) * tick;
}
