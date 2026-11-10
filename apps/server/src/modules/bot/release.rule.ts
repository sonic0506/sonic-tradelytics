import {
  RELEASE_THRESHOLDS,
  type ReleaseCriterionKey,
} from './bot.constants.js';

export interface ReleaseCriterion {
  key: ReleaseCriterionKey;
  value: number | null;
  threshold: number;
  passed: boolean;
}

const PERCENT = 100;
const PRECISION = 100;
// MDD 기준은 누적 손실 한도의 절반이에요
const MDD_SHARE_OF_LOSS_LIMIT = 0.5;

// 상한 해제 기준 (POL-RISK-13). 현재 버전의 검증 구간 기록만 받아요.
// closedPnls: 청산 포지션의 순손익(수수료·세금 차감)을 청산 순서대로. MDD는 이 순서의 누적 곡선으로 재요
// ponytail: 보유 중 평가 손익은 넣지 않아요. 검증 기준은 확정된 손익만 봐요
export function releaseCriteria(input: {
  tradingDays: number;
  closedPnls: number[];
  amount: number;
  totalLossPct: number;
}): ReleaseCriterion[] {
  const { tradingDays, closedPnls, amount, totalLossPct } = input;
  const netPnl = closedPnls.reduce((sum, pnl) => sum + pnl, 0);
  const wins = closedPnls.filter((pnl) => pnl > 0);
  const losses = closedPnls.filter((pnl) => pnl < 0);
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  // 손실이 한 번도 없으면 손익비를 셀 수 없어요. 이긴 거래가 있으면 통과로 봐요
  const profitFactor =
    losses.length === 0 || wins.length === 0
      ? null
      : average(wins) / Math.abs(average(losses));

  let peak = 0;
  let cumulative = 0;
  let drawdown = 0;
  for (const pnl of closedPnls) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }
  const mdd = amount > 0 ? (drawdown / amount) * PERCENT : 0;
  const mddLimit = totalLossPct * MDD_SHARE_OF_LOSS_LIMIT;

  const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
  return [
    {
      key: 'period',
      value: tradingDays,
      threshold: RELEASE_THRESHOLDS.period,
      passed: tradingDays >= RELEASE_THRESHOLDS.period,
    },
    {
      key: 'closed_trades',
      value: closedPnls.length,
      threshold: RELEASE_THRESHOLDS.closedTrades,
      passed: closedPnls.length >= RELEASE_THRESHOLDS.closedTrades,
    },
    {
      key: 'net_pnl',
      value: netPnl,
      threshold: RELEASE_THRESHOLDS.netPnl,
      passed: netPnl > RELEASE_THRESHOLDS.netPnl,
    },
    {
      key: 'profit_factor',
      value: profitFactor === null ? null : round(profitFactor),
      threshold: RELEASE_THRESHOLDS.profitFactor,
      passed:
        profitFactor === null
          ? wins.length > 0
          : profitFactor >= RELEASE_THRESHOLDS.profitFactor,
    },
    {
      key: 'mdd',
      value: round(mdd),
      threshold: mddLimit,
      passed: mdd <= mddLimit,
    },
  ];
}
