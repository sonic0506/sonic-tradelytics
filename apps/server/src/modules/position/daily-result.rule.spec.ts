import { type DailyPosition, dailyResults } from './daily-result.rule.js';

describe('dailyResults', () => {
  const dayStart = new Date('2026-11-09T00:00:00+09:00');
  const position = (fields: Partial<DailyPosition>): DailyPosition => ({
    botId: 1,
    symbol: '005930',
    status: 'closed',
    quantity: 0,
    costBasis: 0,
    realizedPnl: 0,
    totalFees: 0,
    closedAt: new Date('2026-11-09T15:15:00+09:00'),
    ...fields,
  });

  it('그날 닫힌 포지션의 실현 손익·비용·건수를 봇마다 더해요', () => {
    const rows = dailyResults(
      [1],
      [
        position({ realizedPnl: 500, totalFees: 30 }),
        position({ realizedPnl: -200, totalFees: 20 }),
      ],
      dayStart,
      new Map(),
    );

    expect(rows).toEqual([
      {
        botId: 1,
        realizedPnl: 300,
        unrealizedPnl: 0,
        fees: 50,
        closedTrades: 2,
      },
    ]);
  });

  it('전날 닫힌 포지션은 세지 않아요', () => {
    const rows = dailyResults(
      [1],
      [
        position({
          realizedPnl: 500,
          closedAt: new Date('2026-11-06T15:15:00+09:00'),
        }),
      ],
      dayStart,
      new Map(),
    );

    expect(rows[0]?.closedTrades).toBe(0);
    expect(rows[0]?.realizedPnl).toBe(0);
  });

  it('남은 보유분은 최근가로 평가하고, 최근가가 없으면 0이에요', () => {
    const rows = dailyResults(
      [1],
      [
        position({
          status: 'open',
          quantity: 3,
          costBasis: 30_000,
          closedAt: null,
        }),
        position({
          status: 'open',
          symbol: '000660',
          quantity: 1,
          costBasis: 100_000,
          closedAt: null,
        }),
      ],
      dayStart,
      new Map([['005930', 10_500]]),
    );

    expect(rows[0]?.unrealizedPnl).toBe(1500);
  });

  it('거래가 없는 봇도 0으로 한 줄을 남기고, 목록에 없는 봇의 포지션은 빼요', () => {
    const rows = dailyResults(
      [1, 2],
      [position({ botId: 3, realizedPnl: 999 })],
      dayStart,
      new Map(),
    );

    expect(rows).toEqual([
      { botId: 1, realizedPnl: 0, unrealizedPnl: 0, fees: 0, closedTrades: 0 },
      { botId: 2, realizedPnl: 0, unrealizedPnl: 0, fees: 0, closedTrades: 0 },
    ]);
  });
});
