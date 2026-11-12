import type { ExitReason, PositionStatus } from './position.constants.js';

export interface DailyPosition {
  botId: number;
  symbol: string;
  status: PositionStatus;
  quantity: number;
  costBasis: number;
  realizedPnl: number;
  totalFees: number;
  closedAt: Date | null;
  exitReason: ExitReason | null;
}

export interface DailyResultRow {
  botId: number;
  realizedPnl: number;
  unrealizedPnl: number;
  fees: number;
  closedTrades: number;
}

// 봇마다 그날 닫힌 포지션의 실현 손익(차감 후)·비용·건수와, 장 마감에 남은 보유분의 평가 손익을 모아요 (FR-PERF-03).
// 최근가가 없는 보유분은 평가 손익 0으로 둬요. 한 주도 체결되지 않고 닫힌 포지션(not_filled)은 거래로 세지 않아요.
// ponytail: 일부 매도의 실현 손익은 포지션이 닫히는 날 한꺼번에 잡아요. 날을 넘겨 들고 가는 봇(M6)이 생기면 체결일로 나눠요
export function dailyResults(
  botIds: number[],
  positions: DailyPosition[],
  dayStart: Date,
  prices: ReadonlyMap<string, number>,
): DailyResultRow[] {
  const rows = new Map(
    botIds.map((botId) => [
      botId,
      { botId, realizedPnl: 0, unrealizedPnl: 0, fees: 0, closedTrades: 0 },
    ]),
  );
  for (const position of positions) {
    const row = rows.get(position.botId);
    if (!row) continue;
    if (position.status === 'closed') {
      if (!position.closedAt || position.closedAt < dayStart) continue;
      if (position.exitReason === 'not_filled') continue;
      row.realizedPnl += position.realizedPnl;
      row.fees += position.totalFees;
      row.closedTrades += 1;
      continue;
    }
    const price = prices.get(position.symbol);
    if (price !== undefined && position.quantity > 0)
      row.unrealizedPnl += price * position.quantity - position.costBasis;
  }
  return [...rows.values()];
}
