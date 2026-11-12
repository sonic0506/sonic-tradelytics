// 정확도 분석 (FR-RAT-05, 06). 채점 정의는 docs/product/features/f3-rationale-report.md에만 있어요

export interface ScoredPrediction {
  botId: number;
  directionHit: boolean;
  // 0~100
  targetReachPct: number;
  errorPct: number;
}

export interface AccuracyRates {
  scoredCount: number;
  // 0~1
  directionHitRate: number;
  // 목표 도달률 평균 (0~1)
  targetReachRate: number;
  // 평균 예측 오차, %
  avgErrorPct: number;
}

// 신뢰 점수 구간 (api.md accuracy-stats scoreBuckets), 높은 구간부터
const SCORE_BUCKETS = [
  { min: 90, max: 100 },
  { min: 80, max: 89 },
  { min: 70, max: 79 },
  { min: 60, max: 69 },
  { min: 0, max: 59 },
] as const;

const PERCENT = 100;
const PRECISION = 100;
const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
const average = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;

// 채점된 예측의 방향 적중률, 목표 도달률 평균, 평균 오차. 채점이 없으면 모두 0이에요
export function accuracyRates(scores: ScoredPrediction[]): AccuracyRates {
  return {
    scoredCount: scores.length,
    directionHitRate: round(
      average(scores.map(({ directionHit }) => (directionHit ? 1 : 0))),
    ),
    targetReachRate: round(
      average(scores.map(({ targetReachPct }) => targetReachPct / PERCENT)),
    ),
    avgErrorPct: round(average(scores.map(({ errorPct }) => errorPct))),
  };
}

export interface ScoreBucket {
  min: number;
  max: number;
  closedCount: number;
  // 0~1. 청산이 없으면 0
  winRate: number;
}

// 진입 판단의 신뢰 점수 구간별 청산 수와 승률 (순손익 > 0이면 이김)
export function scoreBuckets(
  entries: { score: number; netPnl: number }[],
): ScoreBucket[] {
  return SCORE_BUCKETS.map(({ min, max }) => {
    const inBucket = entries.filter(
      ({ score }) => score >= min && score <= max,
    );
    return {
      min,
      max,
      closedCount: inBucket.length,
      winRate: round(
        average(inBucket.map(({ netPnl }) => (netPnl > 0 ? 1 : 0))),
      ),
    };
  });
}
