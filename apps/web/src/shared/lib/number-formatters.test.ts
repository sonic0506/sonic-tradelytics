import { describe, expect, it } from 'vitest';

import {
  formatRatio,
  formatSignedManWon,
  formatSignedPercent,
  formatSignedWon,
} from './number-formatters';

describe('formatSignedWon', () => {
  it('이익에는 +, 손실에는 마이너스 기호를 붙여요', () => {
    expect(formatSignedWon(81842)).toBe('+81,842원');
    expect(formatSignedWon(-12300)).toBe('−12,300원');
  });

  it('0은 부호 없이 써요', () => {
    expect(formatSignedWon(0)).toBe('0원');
  });
});

describe('formatSignedPercent', () => {
  it('소수 둘째 자리까지 부호와 함께 써요', () => {
    expect(formatSignedPercent(0.66)).toBe('+0.66%');
    expect(formatSignedPercent(-2.544)).toBe('−2.54%');
  });

  it('반올림해서 0이 되면 부호를 붙이지 않아요', () => {
    expect(formatSignedPercent(-0.001)).toBe('0.00%');
  });
});

describe('formatRatio', () => {
  it('0~1 비율을 정수 %로 바꿔요', () => {
    expect(formatRatio(0.58)).toBe('58%');
  });
});

describe('formatSignedManWon', () => {
  it('만 원 단위로 줄여 써요', () => {
    expect(formatSignedManWon(200000)).toBe('+20만');
    expect(formatSignedManWon(-200000)).toBe('−20만');
    expect(formatSignedManWon(0)).toBe('0');
  });
});
