import { describe, expect, it } from 'vitest';

import { formatHoldingTime } from './rationale-text';

describe('formatHoldingTime', () => {
  it('하루가 안 되면 시간과 분으로 써요', () => {
    expect(formatHoldingTime(1_067)).toBe('17시간 47분');
  });

  it('한 시간이 안 되면 분만 써요', () => {
    expect(formatHoldingTime(42)).toBe('42분');
  });

  it('하루가 넘으면 일과 시간으로 써요', () => {
    expect(formatHoldingTime(3_060)).toBe('2일 3시간');
  });
});
