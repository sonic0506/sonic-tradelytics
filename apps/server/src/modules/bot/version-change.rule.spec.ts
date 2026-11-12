import { versionChange, type VersionValues } from './version-change.rule.js';

describe('versionChange', () => {
  const current: VersionValues = {
    params: { maxRank: 30, exitAt: '15:20:00' },
    orderSizeValue: 50_000,
    splitCount: 1,
    maxPositions: 2,
    dailyLossPct: 4,
    totalLossPct: 10,
    stopStreak: 3,
    onDailyLimit: 'liquidate',
  };

  it('바뀐 값이 없으면 변경 종류가 null이에요', () => {
    expect(versionChange(current, current)).toEqual({
      changeKind: null,
      changes: [],
    });
  });

  it('손실 한도·연속 손절·1회 주문 금액을 줄이기만 하면 risk_only예요', () => {
    expect(
      versionChange(current, {
        ...current,
        dailyLossPct: 3,
        orderSizeValue: 40_000,
      }),
    ).toEqual({
      changeKind: 'risk_only',
      changes: [
        { label: '하루 손실 한도', from: '4%', to: '3%' },
        { label: '1회 주문 금액', from: '50,000원', to: '40,000원' },
      ],
    });
  });

  it('손실 한도를 높이면 decision_change예요', () => {
    expect(
      versionChange(current, { ...current, totalLossPct: 12 }).changeKind,
    ).toBe('decision_change');
  });

  it('규칙 값이나 그 밖의 값이 하나라도 바뀌면 decision_change이고, 시각은 HH:mm으로 보여줘요', () => {
    expect(
      versionChange(current, {
        ...current,
        params: { maxRank: 30, exitAt: '15:10:00' },
        dailyLossPct: 3,
      }),
    ).toEqual({
      changeKind: 'decision_change',
      changes: [
        { label: '장 마감 전 청산', from: '15:20', to: '15:10' },
        { label: '하루 손실 한도', from: '4%', to: '3%' },
      ],
    });
    expect(
      versionChange(current, { ...current, maxPositions: 3 }).changeKind,
    ).toBe('decision_change');
  });
});
