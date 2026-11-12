import { accuracyRates, scoreBuckets } from './accuracy.rule.js';

describe('accuracyRates', () => {
  it('방향 적중률·목표 도달률 평균·평균 오차를 재요', () => {
    expect(
      accuracyRates([
        { botId: 1, directionHit: true, targetReachPct: 100, errorPct: 0.5 },
        { botId: 1, directionHit: false, targetReachPct: 20, errorPct: -1.5 },
        { botId: 1, directionHit: true, targetReachPct: 60, errorPct: -0.5 },
      ]),
    ).toEqual({
      scoredCount: 3,
      directionHitRate: 0.67,
      targetReachRate: 0.6,
      avgErrorPct: -0.5,
    });
  });

  it('채점이 없으면 모두 0이에요', () => {
    expect(accuracyRates([])).toEqual({
      scoredCount: 0,
      directionHitRate: 0,
      targetReachRate: 0,
      avgErrorPct: 0,
    });
  });
});

describe('scoreBuckets', () => {
  it('높은 구간부터 구간 경계를 포함해 청산 수와 승률을 줘요', () => {
    const buckets = scoreBuckets([
      { score: 90, netPnl: 100 },
      { score: 89, netPnl: -100 },
      { score: 80, netPnl: 100 },
      { score: 59, netPnl: 0 },
    ]);

    expect(buckets).toEqual([
      { min: 90, max: 100, closedCount: 1, winRate: 1 },
      { min: 80, max: 89, closedCount: 2, winRate: 0.5 },
      { min: 70, max: 79, closedCount: 0, winRate: 0 },
      { min: 60, max: 69, closedCount: 0, winRate: 0 },
      { min: 0, max: 59, closedCount: 1, winRate: 0 },
    ]);
  });
});
