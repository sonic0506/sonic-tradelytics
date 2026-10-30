import { describe, expect, it } from 'vitest';

import {
  type BasicSettingsDraft,
  validateBasicSettings,
} from './validate-basic-settings';

const DRAFT: BasicSettingsDraft = {
  name: '종가 베팅 B',
  periodEnd: '2026-12-31',
  isIndefinite: false,
  onPeriodEnd: 'liquidate',
  startPriority: '2',
  tradingStart: '15:10',
  tradingEnd: '15:20',
};

describe('validateBasicSettings', () => {
  it('값이 맞으면 통과해요', () => {
    expect(validateBasicSettings(DRAFT, '2026-10-30')).toEqual({});
  });

  it('운영 종료가 정규장을 넘으면 고치는 방법을 알려 줘요', () => {
    expect(
      validateBasicSettings({ ...DRAFT, tradingEnd: '15:40' }, '2026-10-30'),
    ).toEqual({ tradingEnd: '09:00~15:30 안으로 입력해 주세요.' });
  });

  it('종료일이 오늘보다 앞이면 막아요', () => {
    expect(
      validateBasicSettings({ ...DRAFT, periodEnd: '2026-10-29' }, '2026-10-30')
        .periodEnd,
    ).toBe('오늘이나 그 뒤 날짜로 골라 주세요.');
  });

  it('계속 운용이면 종료일을 보지 않아요', () => {
    expect(
      validateBasicSettings(
        { ...DRAFT, isIndefinite: true, periodEnd: '' },
        '2026-10-30',
      ),
    ).toEqual({});
  });
});
