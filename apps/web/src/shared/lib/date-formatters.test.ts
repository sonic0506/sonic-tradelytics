import { describe, expect, it } from 'vitest';

import { formatDateTime, formatMonthDayTime } from './date-formatters';

describe('formatMonthDayTime', () => {
  it('서울 시각으로 월/일 시:분을 써요', () => {
    expect(formatMonthDayTime('2026-10-28T06:18:00Z')).toBe('10/28 15:18');
  });
});

describe('formatDateTime', () => {
  it('서울 시각으로 연-월-일 시:분을 써요', () => {
    expect(formatDateTime('2026-10-01T15:00:00+09:00')).toBe(
      '2026-10-01 15:00',
    );
  });
});
