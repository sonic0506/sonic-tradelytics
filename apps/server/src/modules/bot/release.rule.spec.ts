import { releaseCriteria } from './release.rule.js';

describe('releaseCriteria', () => {
  const passing = {
    tradingDays: 10,
    // 이긴 거래 20건(+300), 진 거래 10건(-150): 순손익 4,500, 손익비 2
    closedPnls: [
      ...Array.from({ length: 20 }, () => 300),
      ...Array.from({ length: 10 }, () => -150),
    ],
    amount: 100_000,
    totalLossPct: 10,
  };
  const byKey = (input: Parameters<typeof releaseCriteria>[0]) =>
    Object.fromEntries(releaseCriteria(input).map((c) => [c.key, c]));

  it('다섯 기준을 모두 넘으면 모두 통과예요', () => {
    expect(releaseCriteria(passing).every(({ passed }) => passed)).toBe(true);
  });

  it('거래일과 청산 건수는 기준값과 같으면 통과하고 하나 모자라면 미달이에요', () => {
    const criteria = byKey({
      ...passing,
      tradingDays: 9,
      closedPnls: passing.closedPnls.slice(1),
    });

    expect(criteria.period).toMatchObject({ value: 9, passed: false });
    expect(criteria.closed_trades).toMatchObject({ value: 29, passed: false });
  });

  it('순손익이 0원이면 미달이에요', () => {
    expect(
      byKey({ ...passing, closedPnls: [300, -300] }).net_pnl,
    ).toMatchObject({
      value: 0,
      passed: false,
    });
  });

  it('손익비는 평균 이익 ÷ 평균 손실이고 1.5 미만이면 미달이에요', () => {
    const criteria = byKey({ ...passing, closedPnls: [200, 400, -200] });

    expect(criteria.profit_factor).toMatchObject({ value: 1.5, passed: true });
    expect(
      byKey({ ...passing, closedPnls: [100, -100] }).profit_factor,
    ).toMatchObject({ value: 1, passed: false });
  });

  it('손실 거래가 없으면 손익비는 비우고, 이긴 거래가 있을 때만 통과예요', () => {
    expect(
      byKey({ ...passing, closedPnls: [100] }).profit_factor,
    ).toMatchObject({ value: null, passed: true });
    expect(byKey({ ...passing, closedPnls: [] }).profit_factor).toMatchObject({
      value: null,
      passed: false,
    });
  });

  it('MDD는 청산 순서 누적 손익의 고점 대비 하락을 투자금 대비 %로 재고, 누적 손실 한도 절반까지 통과예요', () => {
    // 고점 +2,000 → 바닥 -3,000: 5,000원 = 5%
    const criteria = byKey({ ...passing, closedPnls: [2_000, -5_000, 4_000] });

    expect(criteria.mdd).toMatchObject({
      value: 5,
      threshold: 5,
      passed: true,
    });
    expect(byKey({ ...passing, closedPnls: [2_000, -5_001] }).mdd?.passed).toBe(
      false,
    );
  });
});
