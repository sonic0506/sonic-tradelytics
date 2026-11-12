// 봇 비교 표의 지표 (FR-PERF-02, F2 "봇별 핵심 지표"). 순손익은 모두 수수료·세금 차감 후 값이에요

export interface ClosedTrade {
  netPnl: number;
  fees: number;
  openedAt: Date;
  closedAt: Date;
}

export interface TradeStats {
  // 청산이 없으면 null
  netPnl: number | null;
  // 0~1
  winRate: number | null;
  profitFactor: number | null;
  avgHoldMinutes: number | null;
  tradeCount: number;
  cost: number;
}

const PERCENT = 100;
const PRECISION = 100;
const MINUTE_MS = 60_000;

const round = (value: number) => Math.round(value * PRECISION) / PRECISION;
const average = (values: number[]) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;

// 순손익 > 0인 청산 수 ÷ 청산 수 (0~1, 소수 둘째 자리). 청산이 없으면 null
export function winRate(pnls: number[]): number | null {
  if (pnls.length === 0) return null;
  return round(pnls.filter((pnl) => pnl > 0).length / pnls.length);
}

// 청산 포지션으로 승률·손익비·보유 시간·비용을 재요. 손실 거래가 없거나 이긴 거래가 없으면 손익비는 null이에요
export function tradeStats(trades: ClosedTrade[]): TradeStats {
  const cost = trades.reduce((sum, { fees }) => sum + fees, 0);
  if (trades.length === 0)
    return {
      netPnl: null,
      winRate: null,
      profitFactor: null,
      avgHoldMinutes: null,
      tradeCount: 0,
      cost,
    };
  const pnls = trades.map(({ netPnl }) => netPnl);
  const wins = pnls.filter((pnl) => pnl > 0);
  const losses = pnls.filter((pnl) => pnl < 0);
  return {
    netPnl: pnls.reduce((sum, pnl) => sum + pnl, 0),
    winRate: winRate(pnls),
    profitFactor:
      wins.length === 0 || losses.length === 0
        ? null
        : round(average(wins) / Math.abs(average(losses))),
    avgHoldMinutes: Math.round(
      average(
        trades.map(
          ({ openedAt, closedAt }) =>
            (closedAt.getTime() - openedAt.getTime()) / MINUTE_MS,
        ),
      ),
    ),
    tradeCount: trades.length,
    cost,
  };
}

// 일별 손익을 날짜순으로 쌓은 곡선의 고점 대비 최대 하락을 투자금 대비 %로 줘요. 기록이 없으면 null
export function maxDrawdownPct(
  dailyPnls: number[],
  amount: number,
): number | null {
  if (dailyPnls.length === 0 || amount <= 0) return null;
  let peak = 0;
  let cumulative = 0;
  let drawdown = 0;
  for (const pnl of dailyPnls) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    drawdown = Math.max(drawdown, peak - cumulative);
  }
  return round((drawdown / amount) * PERCENT);
}

// 기간 순손익 ÷ 확정 투자금, %
export function returnRatePct(netPnl: number, amount: number): number | null {
  return amount > 0 ? round((netPnl / amount) * PERCENT) : null;
}
