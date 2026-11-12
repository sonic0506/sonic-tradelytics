import {
  type ClosedTrade,
  maxDrawdownPct,
  returnRatePct,
  tradeStats,
} from './bot-stat.rule.js';

describe('tradeStats', () => {
  const trade = (
    netPnl: number,
    fees: number,
    minutes: number,
  ): ClosedTrade => {
    const openedAt = new Date('2026-11-10T09:10:00+09:00');
    return {
      netPnl,
      fees,
      openedAt,
      closedAt: new Date(openedAt.getTime() + minutes * 60_000),
    };
  };

  it('승률·손익비·평균 보유 시간·비용을 청산 포지션으로 재요', () => {
    expect(
      tradeStats([trade(300, 10, 30), trade(100, 10, 60), trade(-100, 20, 90)]),
    ).toEqual({
      netPnl: 300,
      winRate: 0.67,
      profitFactor: 2,
      avgHoldMinutes: 60,
      tradeCount: 3,
      cost: 40,
    });
  });

  it('청산이 없으면 비율 지표와 순손익은 null이고 건수는 0이에요', () => {
    expect(tradeStats([])).toEqual({
      netPnl: null,
      winRate: null,
      profitFactor: null,
      avgHoldMinutes: null,
      tradeCount: 0,
      cost: 0,
    });
  });

  it('손실 거래가 없으면 손익비는 null이에요', () => {
    expect(tradeStats([trade(100, 0, 10)]).profitFactor).toBeNull();
  });
});

describe('maxDrawdownPct', () => {
  it('누적 곡선의 고점 대비 최대 하락을 투자금 대비 %로 줘요', () => {
    // 0 → +2,000 → -3,000 → +1,000: 고점 2,000에서 5,000 하락
    expect(maxDrawdownPct([2_000, -5_000, 4_000], 100_000)).toBe(5);
  });

  it('처음부터 내려가면 0에서 잰 하락이에요', () => {
    expect(maxDrawdownPct([-4_248, 1_621], 100_000)).toBe(4.25);
  });

  it('기록이 없거나 투자금이 없으면 null이에요', () => {
    expect(maxDrawdownPct([], 100_000)).toBeNull();
    expect(maxDrawdownPct([-1_000], 0)).toBeNull();
  });
});

describe('returnRatePct', () => {
  it('순손익 ÷ 투자금을 %로 줘요. 투자금이 없으면 null이에요', () => {
    expect(returnRatePct(-2_627, 100_000)).toBe(-2.63);
    expect(returnRatePct(100, 0)).toBeNull();
  });
});
