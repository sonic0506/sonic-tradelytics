import { describe, expect, it } from 'vitest';

import { getAxisMax } from './chart-scale';

describe('getAxisMax', () => {
  it('가장 큰 손익을 그 자릿수 단위로 올려요', () => {
    expect(getAxisMax([48_000, -164_000, 112_000])).toBe(200_000);
    expect(getAxisMax([1_742, -900])).toBe(2_000);
  });

  it('딱 맞으면 그대로 써요', () => {
    expect(getAxisMax([-200_000])).toBe(200_000);
  });

  it('손익이 모두 0이면 1,000으로 그려요', () => {
    expect(getAxisMax([0, 0])).toBe(1_000);
    expect(getAxisMax([])).toBe(1_000);
  });
});
