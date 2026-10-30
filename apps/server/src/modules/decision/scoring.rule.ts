import type { Direction } from './decision.constants.js';

// 예측 채점 규칙 (docs/product/features/f3-rationale-report.md 채점 정의, FR-RAT-02, POL-REEV-04).
// 진입가는 판단할 때의 가격(decision.price), 청산가는 실제 평균 매도가예요.

const PERCENT = 100;
const REACH_DIGITS = 2;
const ERROR_DIGITS = 3;

export interface PredictionOutcome {
  direction: Direction;
  entryPrice: number;
  targetPrice: number;
  exitPrice: number;
  // 보유 중 최고가·최저가. 모르면 null (진입가와 청산가로 대신해요)
  highPrice: number | null;
  lowPrice: number | null;
}

export interface PredictionScore {
  directionHit: boolean;
  // 0~100
  targetReachPct: number;
  errorPct: number;
}

const round = (value: number, digits: number): number =>
  Number(value.toFixed(digits));

export function scorePrediction(outcome: PredictionOutcome): PredictionScore {
  const { direction, entryPrice, targetPrice, exitPrice } = outcome;
  const move = exitPrice - entryPrice;
  // ponytail: 보유 중 최고가·최저가를 아직 기록하지 않아 모르면 진입가·청산가 중 유리한 값으로 봐요. BotRunner가 기록하면 정확해져요
  const high = outcome.highPrice ?? Math.max(entryPrice, exitPrice);
  const low = outcome.lowPrice ?? Math.min(entryPrice, exitPrice);
  const isUp = direction === 'up';

  // 목표까지 가야 할 거리 대비 실제로 간 거리 (하락 예측은 대칭)
  const needed = isUp ? targetPrice - entryPrice : entryPrice - targetPrice;
  const reached = isUp ? high - entryPrice : entryPrice - low;
  const reachPct =
    needed > 0
      ? Math.min(Math.max((reached / needed) * PERCENT, 0), PERCENT)
      : 0;

  return {
    directionHit: isUp ? move > 0 : move < 0,
    targetReachPct: round(reachPct, REACH_DIGITS),
    errorPct: round(
      ((exitPrice - targetPrice) / entryPrice) * PERCENT,
      ERROR_DIGITS,
    ),
  };
}
