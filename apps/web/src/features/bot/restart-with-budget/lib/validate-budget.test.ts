import { describe, expect, it } from 'vitest';

import { getBudgetError } from './validate-budget';

describe('getBudgetError', () => {
  it('쓸 수 있는 금액 이하의 정수면 통과해요', () => {
    expect(getBudgetError('68000', 68_000)).toBeNull();
  });

  it('쓸 수 있는 금액을 넘으면 알려요', () => {
    expect(getBudgetError('68001', 68_000)).toBe('over_available');
  });

  it('비었거나 0 이하거나 정수가 아니면 알려요', () => {
    expect(getBudgetError('', 68_000)).toBe('not_positive_integer');
    expect(getBudgetError('0', 68_000)).toBe('not_positive_integer');
    expect(getBudgetError('1.5', 68_000)).toBe('not_positive_integer');
  });
});
