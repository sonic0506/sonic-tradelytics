import { describe, expect, it } from 'vitest';

import { getAxisMax } from './chart-scale';

describe('getAxisMax', () => {
  it('가장 큰 손익을 10만 원 단위로 올려요', () => {
    expect(getAxisMax([48_000, -164_000, 112_000])).toBe(200_000);
  });

  it('딱 맞으면 그대로 써요', () => {
    expect(getAxisMax([-200_000])).toBe(200_000);
  });

  it('손익이 모두 0이면 10만으로 그려요', () => {
    expect(getAxisMax([0, 0])).toBe(100_000);
    expect(getAxisMax([])).toBe(100_000);
  });
});
