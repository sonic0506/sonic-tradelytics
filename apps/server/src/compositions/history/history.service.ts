import { Injectable } from '@nestjs/common';

import { kstDate, kstDateTime, kstRange } from '@/common/time/kst-date.js';
import { BotService, ruleCondition } from '@/modules/bot/index.js';
import { type Decision, DecisionService } from '@/modules/decision/index.js';
import { FundQueryService, VERIFICATION_CAP } from '@/modules/fund/index.js';
import {
  MarketCalendarQueryService,
  QuoteQueryService,
} from '@/modules/market-data/index.js';
import {
  type BrokerOrder,
  OPEN_ORDER_STATUSES,
  OrderQueryService,
} from '@/modules/order/index.js';
import {
  type HistoryFilter,
  type Position,
  PositionNotFoundException,
  PositionService,
  positionView,
} from '@/modules/position/index.js';

import type {
  EntryDecisionDto,
  PositionDetailDto,
  PositionOrderDto,
  TimelineItemDto,
} from './dto/position-detail.dto.js';
import type { PositionHistoryQueryDto } from './dto/position-history-query.dto.js';
import {
  type PositionHistoryDto,
  PositionRowResponseDto,
} from './dto/position-row.dto.js';
import type { PositionSummaryDto } from './dto/position-summary.dto.js';

const MANUAL = 'manual';
const MANUAL_NAME = '직접 거래';
const PERCENT = 100;
const PRECISION = 100;
const RATE_PRECISION = 10;
const MINUTE_MS = 60_000;
// kstDateTime "YYYY-MM-DD HH:mm"에서 날짜·시각을 자르는 위치
const DATE_LENGTH = 10;
const MONTH_START = 5;
const TIME_START = 11;
const TIMELINE_TITLES = {
  enter: '진입 판단',
  reeval: '재평가 판단',
  exit: '청산 판단',
} as const;

// controller의 @ApiErrors가 쓰도록 다시 내보내요
export { PositionNotFoundException };

// 투자 내역 화면 (F2, api.md GET /v1/positions·position-summaries). 포지션·체결·최근가를 모아요
@Injectable()
export class HistoryService {
  constructor(
    private readonly positions: PositionService,
    private readonly orders: OrderQueryService,
    private readonly quotes: QuoteQueryService,
    private readonly calendars: MarketCalendarQueryService,
    private readonly funds: FundQueryService,
    private readonly bots: BotService,
    private readonly decisions: DecisionService,
  ) {}

  // 펼친 거래 한 줄: 주문, 진입 판단, 실제 결과, 채점, 판단 흐름 (api.md GET /v1/positions/:id, F3)
  async detail(id: number): Promise<PositionDetailDto> {
    const position = await this.positions.findWithBot(id);
    const [[row], orders, { decisions, scores }] = await Promise.all([
      this.rowsOf([position]),
      this.orders.findByPosition(id),
      this.decisions.forPosition(id),
    ]);
    if (!row) throw new PositionNotFoundException(id);
    const entryDecision = decisions.find(({ kind }) => kind === 'enter');
    const score = scores.find(
      ({ decisionId }) => decisionId === entryDecision?.id,
    );
    const isClosed = row.status === 'closed' && row.exitPrice !== null;
    const exitPrice = row.exitPrice ?? 0;
    const entryPrice = entryDecision?.price ?? row.entryPrice;
    return {
      id: row.id,
      position: row,
      botVersion: entryDecision?.botVersion.version ?? null,
      orders: orders.map(orderOf),
      entry: entryDecision ? entryOf(entryDecision) : null,
      outcome:
        isClosed && position.closedAt
          ? {
              exitPrice,
              holdingMinutes: Math.round(
                (position.closedAt.getTime() - position.openedAt.getTime()) /
                  MINUTE_MS,
              ),
              // ponytail: 최고·최저가 시각을 기록하지 않아 null이에요. BotRunner가 기록하면 채워요
              highPrice:
                position.highPrice ?? Math.max(row.entryPrice, exitPrice),
              highAt: null,
              lowPrice:
                position.lowPrice ?? Math.min(row.entryPrice, exitPrice),
              lowAt: null,
            }
          : null,
      scoring:
        score && isClosed
          ? {
              directionHit: score.directionHit,
              actualDirection:
                exitPrice > entryPrice
                  ? 'up'
                  : exitPrice < entryPrice
                    ? 'down'
                    : 'flat',
              targetReachPct: score.targetReachPct,
              errorPct: score.errorPct,
            }
          : null,
      timeline: decisions.flatMap(timelineOf),
    };
  }

  async history(query: PositionHistoryQueryDto): Promise<PositionHistoryDto> {
    const { holdings, rows, total } = await this.positions.history(
      filterOf(query),
      query.skip,
      query.size,
    );
    const items = await this.rowsOf([...holdings, ...rows]);
    const quoted = items.flatMap(({ quotedAt }) =>
      quotedAt ? [quotedAt] : [],
    );
    return {
      items,
      meta: { page: query.page, size: query.size, total },
      quotedAt: quoted.length
        ? new Date(Math.max(...quoted.map((at) => at.getTime())))
        : null,
    };
  }

  // 봇 하나면 그 봇의 자금 요약, 아니면 필터에 맞는 포지션 전체 요약
  async summary(query: PositionHistoryQueryDto): Promise<PositionSummaryDto> {
    const [only] = query.botIds ?? [];
    if (query.botIds?.length === 1 && only !== undefined && only !== MANUAL)
      return this.botSummary(Number(only));
    const positions = await this.positions.historyAll(filterOf(query));
    const [rows, totals] = await Promise.all([
      this.rowsOf(positions),
      this.orders.fillTotals(positions.map(({ id }) => id)),
    ]);
    const shares = new Map<string | null, { name: string; pnl: number }>();
    for (const row of rows) {
      const share = shares.get(row.botId) ?? {
        name: row.botName ?? MANUAL_NAME,
        pnl: 0,
      };
      share.pnl += row.netPnl;
      shares.set(row.botId, share);
    }
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    const holding = rows.filter(({ status }) => status === 'holding');
    const closed = rows.filter(({ status }) => status === 'closed');
    return {
      kind: 'overall',
      tradeCount: holding.length + closed.length,
      holdingCount: holding.length,
      closedCount: closed.length,
      netPnl: sum(positions.map(({ realizedPnl }) => realizedPnl)),
      unrealizedPnl: sum(
        holding.map(({ unrealizedPnl }) => unrealizedPnl ?? 0),
      ),
      cost: sum([...totals.values()].map(({ commission }) => commission)),
      tax: sum([...totals.values()].map(({ tax }) => tax)),
      botPnls: [...shares].map(([botId, share]) => ({ botId, ...share })),
    };
  }

  private async botSummary(botId: number): Promise<PositionSummaryDto> {
    const [bot, [withVersion], funds, held] = await Promise.all([
      this.bots.findById(botId),
      this.bots.findWithVersions([botId]),
      this.funds.viewsOf([botId]),
      this.positions.findHeldByBot(botId),
    ]);
    const view = funds.get(botId);
    const prices = await this.quotes.pricesOf(held.map(({ symbol }) => symbol));
    const unrealized = held.reduce((sum, position) => {
      const price = prices.get(position.symbol);
      return price === undefined
        ? sum
        : sum + price * position.quantity - position.costBasis;
    }, 0);
    const amount = view?.amount ?? 0;
    const cumulativePnl = (view?.realizedPnl ?? 0) + unrealized;
    const totalLossPct = withVersion?.version?.totalLossPct ?? 0;
    return {
      kind: 'bot',
      budget: amount,
      usedAmount: view?.usedAmount ?? 0,
      remainingBudget: view?.remainingBudget ?? 0,
      capAmount: bot?.stage === 'verifying' ? VERIFICATION_CAP : null,
      cumulativePnl,
      cumulativePnlRate: amount
        ? Math.round((cumulativePnl / amount) * PERCENT * PRECISION) / PRECISION
        : 0,
      tradingDays: view
        ? await this.calendars.countOpenDays(
            kstDate(view.allocatedAt),
            kstDate(),
          )
        : 0,
      lossStopRemaining: view
        ? this.funds.lossRoom(amount, totalLossPct, cumulativePnl)
        : 0,
      lossLimitPercent: totalLossPct,
    };
  }

  private async rowsOf(
    positions: Position[],
  ): Promise<PositionRowResponseDto[]> {
    const held = positions.filter(
      (position) => positionView(position) === 'holding',
    );
    const [totals, quotes] = await Promise.all([
      this.orders.fillTotals(positions.map(({ id }) => id)),
      this.quotes.quotesOf([...new Set(held.map(({ symbol }) => symbol))]),
    ]);
    return positions.map((position) =>
      PositionRowResponseDto.from(
        position,
        totals.get(position.id),
        quotes.get(position.symbol),
      ),
    );
  }
}

function filterOf(query: PositionHistoryQueryDto): HistoryFilter {
  const { start, end } = kstRange(query.from, query.to);
  const botIds = query.botIds?.filter((id) => id !== MANUAL).map(Number);
  return {
    start,
    end,
    botIds,
    includeManual: query.botIds?.includes(MANUAL),
    symbol: query.symbol,
    result: query.result,
    views: query.status ? [query.status] : undefined,
    exitReasons: query.exitReasons,
  };
}

const rateOf = (price: number, base: number): number =>
  Math.round(((price - base) / base) * PERCENT * RATE_PRECISION) /
  RATE_PRECISION;

function orderOf(order: BrokerOrder): PositionOrderDto {
  const isOpen = OPEN_ORDER_STATUSES.some((status) => status === order.status);
  const isFilled = order.filledQuantity >= order.quantity;
  return {
    id: String(order.id),
    side: order.side,
    kind: order.origin === 'protective' ? 'stop_condition' : 'normal',
    orderedAt: order.orderedAt ?? order.createdAt,
    quantity: order.quantity,
    avgPrice: order.filledQuantity > 0 ? order.avgFilledPrice : null,
    commission: order.commission ?? 0,
    tax: order.tax ?? 0,
    status: isFilled
      ? 'filled'
      : order.filledQuantity > 0
        ? 'partial'
        : isOpen
          ? 'pending'
          : 'canceled',
    statusAt: order.filledAt ?? order.canceledAt,
    origin: order.origin,
  };
}

// "15:20까지", 날짜가 바뀌면 "11-13 09:05까지"
function holdUntil(decidedAt: Date, horizonMinutes: number | null): string {
  if (horizonMinutes === null) return '';
  const from = kstDateTime(decidedAt);
  const until = kstDateTime(
    new Date(decidedAt.getTime() + horizonMinutes * MINUTE_MS),
  );
  const isSameDay = from.slice(0, DATE_LENGTH) === until.slice(0, DATE_LENGTH);
  return `${until.slice(isSameDay ? TIME_START : MONTH_START)}까지`;
}

function entryOf(decision: Decision): EntryDecisionDto | null {
  const { direction, targetPrice, stopPrice, price } = decision;
  if (direction === null || targetPrice === null || stopPrice === null)
    return null;
  return {
    decidedAt: decision.decidedAt,
    price,
    score: decision.score ?? 0,
    conditions: [
      ...decision.passed.map((result) => ruleCondition(result, true)),
      ...decision.failed.map((result) => ruleCondition(result, false)),
    ],
    prediction: {
      direction,
      targetPrice,
      targetRate: rateOf(targetPrice, price),
      stopPrice,
      stopRate: rateOf(stopPrice, price),
      holdUntil: holdUntil(decision.decidedAt, decision.horizonMinutes),
    },
  };
}

function timelineOf(decision: Decision): TimelineItemDto[] {
  if (decision.kind === 'skip') return [];
  const price = `가격 ${decision.price.toLocaleString('ko-KR')}원`;
  return [
    {
      at: decision.decidedAt,
      kind: decision.kind,
      title: TIMELINE_TITLES[decision.kind],
      detail:
        decision.score === null ? price : `점수 ${decision.score} · ${price}`,
    },
  ];
}
