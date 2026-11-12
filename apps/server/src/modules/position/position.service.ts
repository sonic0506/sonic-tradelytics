import { Injectable, Logger } from '@nestjs/common';

import { kstAt, kstDate } from '@/common/time/kst-date.js';
import { BotService } from '@/modules/bot/index.js';
import {
  MarketCalendarQueryService,
  QuoteQueryService,
} from '@/modules/market-data/index.js';

import { type TradeStats, tradeStats, winRate } from './bot-stat.rule.js';
import { type DailyPosition, dailyResults } from './daily-result.rule.js';
import type { BotDailyResult } from './entities/bot-daily-result.entity.js';
import type { Position } from './entities/position.entity.js';
import { PositionNotFoundException } from './position.exception.js';
import { PositionRepository } from './position.repository.js';
import type { HistoryFilter } from './position.types.js';

// 주문 하나에서 새로 늘어난 체결분
export interface Fill {
  side: 'BUY' | 'SELL';
  quantity: number;
  amount: number;
  // 수수료 + 세금
  fees: number;
  at: Date;
}

// 봇 전체의 하루 손익 합계 (FR-PERF-01, 03)
export interface DailyTotal {
  tradeDate: string;
  // 실현 + 평가 손익
  pnl: number;
  fees: number;
  closedTrades: number;
}

// 봇 비교 표 한 줄의 재료 (FR-PERF-02). 키 null은 직접 거래예요
export interface BotPerformance {
  trades: TradeStats;
  // 기간 안 일별 손익(실현 + 평가), 날짜순. 직접 거래는 비어 있어요
  dailyPnls: number[];
}

const DAY_MS = 86_400_000;
// ponytail: 보유 중과 요약은 한 번에 읽어요. 거래가 아주 많아지면 요약을 SUM 쿼리로 바꿔요
const MAX_HISTORY_ROWS = 10_000;
// 홈 봇 카드: 승률은 최근 30거래일, 일별 손익은 오늘을 뺀 최근 7거래일 (api.md 홈)
const WIN_RATE_DAYS = 30;
const RECENT_DAYS = 7;

// 오늘 손익 (FR-PERF-10). 키 null은 직접 거래예요
export interface TodayPnl {
  // 오늘 연 포지션의 실현 손익 + 보유분 평가 손익(최근가를 아는 종목만)
  byOwner: Map<number | null, number>;
  // 보유 중인 종목 수 (봇·직접 거래 합쳐 종목마다 한 번)
  holdingSymbolCount: number;
}

// 홈 봇 카드의 최근 실적
export interface RecentBotStats {
  // 0~1. 청산이 없으면 null
  winRate30d: number | null;
  // 오래된 순. 기록이 없는 날은 빠져요
  last7Days: number[];
}

// 봇 하나의 보유·실현 손익 (POL-FUND-02, 05)
export interface BotHoldings {
  // 열린 포지션의 매수 금액 합
  holdingsCost: number;
  // since 이후에 연 포지션의 실현 손익 합(수수료·세금 차감)
  realizedPnl: number;
  hasHoldings: boolean;
}

@Injectable()
export class PositionService {
  private readonly logger = new Logger(PositionService.name);

  constructor(
    private readonly positions: PositionRepository,
    private readonly bots: BotService,
    private readonly quotes: QuoteQueryService,
    private readonly calendars: MarketCalendarQueryService,
  ) {}

  // 오늘 손익을 봇마다(직접 거래는 null) 모아요. 봇 상세의 오늘 손익과 같은 계산이에요
  async todayPnl(now: Date): Promise<TodayPnl> {
    const since = kstAt(kstDate(now), '00:00');
    const positions = await this.positions.findHeldOrOpenedSince(since);
    const held = positions.filter(
      ({ status, quantity }) => status === 'open' && quantity > 0,
    );
    const prices = await this.quotes.pricesOf([
      ...new Set(held.map(({ symbol }) => symbol)),
    ]);
    const byOwner = new Map<number | null, number>();
    const add = (owner: number | null, pnl: number) =>
      byOwner.set(owner, (byOwner.get(owner) ?? 0) + pnl);
    for (const position of positions) {
      if (position.openedAt >= since) add(position.botId, position.realizedPnl);
      const price = prices.get(position.symbol);
      if (position.status === 'open' && position.quantity > 0 && price)
        add(position.botId, price * position.quantity - position.costBasis);
    }
    return {
      byOwner,
      holdingSymbolCount: new Set(held.map(({ symbol }) => symbol)).size,
    };
  }

  // 봇마다 최근 30거래일 승률과 오늘을 뺀 최근 7거래일 일별 손익 (홈 봇 카드)
  async recentBotStats(today: string): Promise<Map<number, RecentBotStats>> {
    const [openDays, recentDays] = await Promise.all([
      this.calendars.recentOpenDays(today, WIN_RATE_DAYS),
      this.calendars.recentOpenDays(today, RECENT_DAYS + 1),
    ]);
    const past = recentDays.filter((day) => day < today).slice(0, RECENT_DAYS);
    const [closed, daily] = await Promise.all([
      this.positions.findClosedBetween({
        start: kstAt(openDays.at(-1) ?? today, '00:00'),
      }),
      past.length === 0
        ? Promise.resolve([])
        : this.positions.findDailyResults({ from: past.at(-1), to: past[0] }),
    ]);
    const result = new Map<number, RecentBotStats>();
    const statsOf = (botId: number) => {
      const stats = result.get(botId) ?? { winRate30d: null, last7Days: [] };
      result.set(botId, stats);
      return stats;
    };
    const tradesByBot = new Map<number, number[]>();
    for (const { botId, realizedPnl } of closed)
      if (botId !== null)
        tradesByBot.set(botId, [
          ...(tradesByBot.get(botId) ?? []),
          realizedPnl,
        ]);
    for (const [botId, pnls] of tradesByBot)
      statsOf(botId).winRate30d = winRate(pnls);
    for (const row of daily)
      statsOf(row.botId).last7Days.push(row.realizedPnl + row.unrealizedPnl);
    return result;
  }

  // since 이후 청산된 봇 포지션의 순손익, 청산 순서대로 (상한 해제 기준, POL-RISK-13)
  closedPnlsSince(botId: number, since: Date): Promise<number[]> {
    return this.positions.findClosedPnlsSince(botId, since);
  }

  // 투자 내역 한 페이지. 상태를 정하지 않으면 보유 중은 페이지와 상관없이 첫 페이지 맨 위에 모두 넣어요 (FR-PERF-06)
  async history(
    filter: HistoryFilter,
    skip: number,
    size: number,
  ): Promise<{ holdings: Position[]; rows: Position[]; total: number }> {
    if (filter.views?.length) {
      const [rows, total] = await this.positions.findHistory(
        filter,
        skip,
        size,
      );
      return { holdings: [], rows, total };
    }
    const [[holdings], [rows, total]] = await Promise.all([
      this.positions.findHistory(
        { ...filter, views: ['holding'] },
        0,
        MAX_HISTORY_ROWS,
      ),
      this.positions.findHistory(
        { ...filter, views: ['pending', 'closed', 'canceled'] },
        skip,
        size,
      ),
    ]);
    return {
      holdings: skip === 0 ? holdings : [],
      rows,
      total: total + holdings.length,
    };
  }

  // 투자 내역 요약용: 필터에 맞는 포지션 모두
  async historyAll(filter: HistoryFilter): Promise<Position[]> {
    const [rows] = await this.positions.findHistory(
      filter,
      0,
      MAX_HISTORY_ROWS,
    );
    return rows;
  }

  // 봇 전체 일별 손익을 날짜마다 더해요. 직접 거래는 bot_daily_results에 없어서 빠져요
  async dailyTotals(from: string, to: string): Promise<DailyTotal[]> {
    const totals = new Map<string, DailyTotal>();
    for (const row of await this.positions.findDailyResults({ from, to })) {
      const total = totals.get(row.tradeDate) ?? {
        tradeDate: row.tradeDate,
        pnl: 0,
        fees: 0,
        closedTrades: 0,
      };
      total.pnl += row.realizedPnl + row.unrealizedPnl;
      total.fees += row.fees;
      total.closedTrades += row.closedTrades;
      totals.set(row.tradeDate, total);
    }
    return [...totals.values()];
  }

  // 기간(거래일, 포함) 안에 청산한 거래와 일별 손익을 봇마다(직접 거래는 null) 모아요
  async performance(range: {
    from?: string;
    to?: string;
  }): Promise<Map<number | null, BotPerformance>> {
    const [closed, daily] = await Promise.all([
      this.positions.findClosedBetween({
        start: range.from ? kstAt(range.from, '00:00') : undefined,
        end: range.to
          ? new Date(kstAt(range.to, '00:00').getTime() + DAY_MS)
          : undefined,
      }),
      this.positions.findDailyResults(range),
    ]);
    const owners = new Set<number | null>([
      ...closed.map(({ botId }) => botId),
      ...daily.map(({ botId }) => botId),
    ]);
    return new Map(
      [...owners].map((owner) => [
        owner,
        {
          trades: tradeStats(
            closed.flatMap((position) =>
              position.botId === owner && position.closedAt
                ? [
                    {
                      netPnl: position.realizedPnl,
                      fees: position.totalFees,
                      openedAt: position.openedAt,
                      closedAt: position.closedAt,
                    },
                  ]
                : [],
            ),
          ),
          dailyPnls: daily
            .filter(({ botId }) => botId === owner)
            .map((row) => row.realizedPnl + row.unrealizedPnl),
        },
      ]),
    );
  }

  botDailyResults(
    botId: number,
    range: { from?: string; to?: string },
  ): Promise<BotDailyResult[]> {
    return this.positions.findDailyResults({ botId, ...range });
  }

  // 장후 배치: 실행 중인 봇과 그날 포지션이 있던 봇의 일일 손익을 bot_daily_results에 써요 (FR-PERF-03)
  async recordDailyResults(tradeDate: string): Promise<void> {
    const dayStart = kstAt(tradeDate, '00:00');
    const positions = (
      await this.positions.findForDailyResults(dayStart)
    ).flatMap((position): DailyPosition[] =>
      position.botId === null ? [] : [{ ...position, botId: position.botId }],
    );
    const trading = await this.bots.findTrading();
    const tradingIds = new Set(trading.map(({ bot }) => bot.id));
    const others = await this.bots.findWithVersions([
      ...new Set(
        positions
          .map(({ botId }) => botId)
          .filter((botId) => !tradingIds.has(botId)),
      ),
    ]);
    const versions = new Map<number, number>();
    for (const { bot, version } of [...trading, ...others])
      if (version) versions.set(bot.id, version.id);
      else
        this.logger.warn(
          `봇 ${bot.id}는 적용된 버전이 없어 일일 집계를 건너뛰어요`,
        );

    const held = [
      ...new Set(
        positions
          .filter(({ status, quantity }) => status === 'open' && quantity > 0)
          .map(({ symbol }) => symbol),
      ),
    ];
    const prices = await this.quotes.pricesOf(held);
    const unpriced = held.filter((symbol) => !prices.has(symbol));
    if (unpriced.length > 0)
      this.logger.warn(
        `최근가가 없어 평가 손익을 0으로 둬요: ${unpriced.join(', ')}`,
      );

    const rows = dailyResults(
      [...versions.keys()],
      positions,
      dayStart,
      prices,
    );
    await this.positions.upsertDailyResults(
      rows.flatMap((row) => {
        const botVersionId = versions.get(row.botId);
        return botVersionId === undefined
          ? []
          : [{ ...row, tradeDate, botVersionId }];
      }),
    );
  }

  // 봇마다 since(그 배분의 확정 시각) 이후 실현 손익과 지금 보유분을 모아요
  async botHoldings(
    bots: { botId: number; since: Date }[],
  ): Promise<Map<number, BotHoldings>> {
    const result = new Map<number, BotHoldings>(
      bots.map(({ botId }) => [
        botId,
        { holdingsCost: 0, realizedPnl: 0, hasHoldings: false },
      ]),
    );
    if (bots.length === 0) return result;
    const sinceByBot = new Map(bots.map(({ botId, since }) => [botId, since]));
    const earliest = new Date(
      Math.min(...bots.map(({ since }) => since.getTime())),
    );
    const positions = await this.positions.findForFunds(
      bots.map(({ botId }) => botId),
      earliest,
    );
    for (const position of positions) {
      const holdings =
        position.botId === null ? undefined : result.get(position.botId);
      const since =
        position.botId === null ? undefined : sinceByBot.get(position.botId);
      if (!holdings || !since) continue;
      if (position.status === 'open') {
        holdings.holdingsCost += position.costBasis;
        holdings.hasHoldings ||= position.quantity > 0;
      }
      if (position.openedAt >= since)
        holdings.realizedPnl += position.realizedPnl;
    }
    return result;
  }

  // 체결 뒤에 확정된 수수료·세금(늘어난 만큼)을 실현 손익에서 빼요 (NFR-05)
  addFees(positionId: number, fees: number): Promise<void> {
    return this.positions.addFees(positionId, fees);
  }

  findHeldByBot(botId?: number): Promise<Position[]> {
    return this.positions.findHeldByBot(botId);
  }

  findOpenByBot(botId: number): Promise<Position[]> {
    return this.positions.findOpenByBot(botId);
  }

  findClosedSymbolsSince(botId: number, since: Date): Promise<string[]> {
    return this.positions.findClosedSymbolsSince(botId, since);
  }

  recentExitReasons(
    botId: number,
    since: Date,
    take: number,
  ): Promise<(string | null)[]> {
    return this.positions.recentExitReasons(botId, since, take);
  }

  // 투자 내역 펼친 줄 (봇 이름·유형 포함). 없으면 404
  async findWithBot(positionId: number): Promise<Position> {
    const position = await this.positions.findWithBot(positionId);
    if (!position) throw new PositionNotFoundException(positionId);
    return position;
  }

  find(positionId: number): Promise<Position | null> {
    return this.positions.findById(positionId);
  }

  // 청산을 시작할 때 사유를 먼저 적어 둬요. 수량이 0이 되어 닫힐 때 그대로 남아요
  setExitReason(
    positionId: number,
    exitReason: NonNullable<Position['exitReason']>,
  ): Promise<void> {
    return this.positions.setExitReason(positionId, exitReason);
  }

  // 수량이 0인 봇 포지션을 사유와 함께 닫아요. 닫았으면 true
  closeFlat(
    positionId: number,
    exitReason: NonNullable<Position['exitReason']>,
    closedAt: Date,
  ): Promise<boolean> {
    return this.positions.closeIfEmpty(positionId, exitReason, closedAt);
  }

  // 진입 판단의 포지션 (수량 0에서 시작)
  openForBot(botId: number, symbol: string, openedAt: Date): Promise<Position> {
    return this.positions.createForBot(botId, symbol, openedAt);
  }

  // 한 주도 체결되지 않고 끝난 포지션을 닫아요 (F2 "취소"). 체결이 있으면 그대로 두고 false예요
  closeNotFilled(positionId: number, closedAt: Date): Promise<boolean> {
    return this.positions.closeIfEmpty(positionId, 'not_filled', closedAt);
  }

  // 직접 거래 주문을 붙일 포지션 (FR-MAN-01). 같은 종목에 열린 것이 있으면 그걸 써요
  async openManual(symbol: string, openedAt: Date): Promise<Position> {
    return (
      (await this.positions.findOpenManual(symbol)) ??
      this.positions.createManual(symbol, openedAt)
    );
  }

  // 체결분을 수량·매수 금액·실현 손익에 반영해요. 수수료·세금은 체결 때마다 실현 손익에서 빼요 (NFR-05).
  // 봇 포지션은 수량이 0이 돼도 여기서 닫지 않아요. 잠금 해제·채점이 함께인 청산 순서가 닫아요
  async applyFill(positionId: number, fill: Fill): Promise<void> {
    const position = await this.positions.findById(positionId);
    if (!position) throw new PositionNotFoundException(positionId);

    let { quantity, costBasis, realizedPnl } = position;
    if (fill.side === 'BUY') {
      quantity += fill.quantity;
      costBasis += fill.amount;
    } else {
      // ponytail: 서비스 시작 전부터 가진 주식을 직접 팔면 매수 금액을 몰라 0원으로 봐요. 과거 주문 가져오기(FR-MAN-06) 때 고쳐요
      const sold = Math.min(fill.quantity, quantity);
      if (sold < fill.quantity)
        this.logger.warn(
          `position ${positionId}: 보유 ${quantity}주보다 많이 팔렸어요 (${fill.quantity}주)`,
        );
      const soldCost =
        quantity === 0 ? 0 : Math.round((costBasis * sold) / quantity);
      quantity -= sold;
      costBasis -= soldCost;
      realizedPnl += fill.amount - soldCost;
    }
    realizedPnl -= fill.fees;

    const isManualClosed = position.botId === null && quantity === 0;
    await this.positions.update(positionId, {
      quantity,
      costBasis,
      realizedPnl,
      totalFees: position.totalFees + fill.fees,
      status: isManualClosed ? 'closed' : position.status,
      closedAt: isManualClosed ? fill.at : position.closedAt,
      exitReason: isManualClosed ? 'manual' : position.exitReason,
    });
  }
}
