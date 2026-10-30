import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';

import { kstAt, kstDate, kstTime } from '@/common/time/kst-date.js';
import {
  type Bot,
  BotService,
  type BotVersion,
  DAY_TRADING_DEFAULTS,
  type DayTradingParams,
  type EntryEvaluation,
  entryPlan,
  evaluateEntry,
  evaluateExit,
  type ExitSignal,
} from '@/modules/bot/index.js';
import { DecisionService, type SkipReason } from '@/modules/decision/index.js';
import { EngineStateService } from '@/modules/engine-state/index.js';
import { FundService } from '@/modules/fund/index.js';
import {
  MarketCalendarService,
  MarketCollectorService,
  MarketScanService,
  type RankedSymbol,
} from '@/modules/market-data/index.js';
import { OrderService } from '@/modules/order/index.js';
import {
  type ExitReason,
  type Position,
  PositionService,
} from '@/modules/position/index.js';
import {
  checkLossLimits,
  entryBanReason,
  isStopStreakHit,
  isTradingWindow,
  RiskService,
} from '@/modules/risk/index.js';

// bot_versions.params. 빠진 값은 기본값으로 채워요. 모양이 틀리면 그 봇을 bot_error로 멈춰요
const paramsSchema = z
  .object({
    maxRank: z.number().int().positive(),
    minPrice: z.number().positive(),
    maxPrice: z.number().positive(),
    minRisePct: z.number(),
    maxRisePct: z.number(),
    vwapBandPct: z.number().nonnegative(),
    takeProfitPcts: z.array(z.number().positive()).min(1),
    vwapExitPct: z.number().positive(),
    stopLossPct: z.number().positive(),
    exitAt: z.string().regex(/^\d{2}:\d{2}:\d{2}$/),
    reentryCooldownMinutes: z.number().int().nonnegative(),
  })
  .partial();

interface Candidate {
  symbol: string;
  // 매수 지정가 (매도 1호가, 없으면 최근 체결가)
  price: number;
  evaluation: EntryEvaluation;
}

// 규칙 청산 신호 → positions.exit_reason (F2)
const EXIT_REASON = {
  time_exit: 'market_close',
  vwap_break: 'rule_exit',
  take_profit: 'take_profit',
} as const satisfies Record<
  Extract<ExitSignal, { action: 'sell' }>['reason'],
  ExitReason
>;

const MINUTE_MS = 60_000;

type SkipBase = Pick<
  Parameters<DecisionService['record']>[0],
  'botVersionId' | 'symbol' | 'price' | 'passed' | 'failed' | 'score'
>;

// 봇 주기 실행 (docs/architecture/engine.md 봇 주기 실행, overview 8단계).
// 봇마다 ③ 손실 한도·연속 손절 → ⑦ 청산 판단 → ①~⑤ 진입 순서로 봐요. 일시정지 봇은 청산만 해요.
// 주문 횟수 상한(POL-RISK-08)은 OrderService.enter가 봐요
@Injectable()
export class BotRunnerService {
  private static readonly CYCLE_MS = 10_000;
  // 거래대금 순위(후보)는 1분마다 다시 받아요
  private static readonly SCAN_MS = 60_000;

  private readonly logger = new Logger(BotRunnerService.name);
  private timer: NodeJS.Timeout | undefined;
  private isCycling = false;
  private ranked: RankedSymbol[] = [];
  private scannedAt = 0;
  // 같은 날 같은 봇·종목·사유의 건너뛴 판단은 한 번만 남겨요 (10초마다 같은 기록이 쌓이지 않게)
  private readonly skipped = new Set<string>();

  constructor(
    private readonly bots: BotService,
    private readonly calendar: MarketCalendarService,
    private readonly collector: MarketCollectorService,
    private readonly scanner: MarketScanService,
    private readonly positions: PositionService,
    private readonly fund: FundService,
    private readonly decisions: DecisionService,
    private readonly orders: OrderService,
    private readonly engineState: EngineStateService,
    private readonly risk: RiskService,
  ) {}

  // engine 시작 순서 10번
  start(): void {
    this.timer = setInterval(() => {
      void this.cycle();
    }, BotRunnerService.CYCLE_MS);
  }

  stop(): void {
    clearInterval(this.timer);
  }

  // 한 주기. 이전 주기가 안 끝났으면 건너뛰어요. 봇은 하나씩 차례로 돌아요
  async cycle(now: Date = new Date()): Promise<void> {
    if (this.isCycling || !this.calendar.isRegularSession(now)) return;
    this.isCycling = true;
    try {
      const running = (await this.bots.findTrading()).filter(
        ({ bot }) => bot.type === 'day_trading',
      );
      if (running.length === 0) return;
      await this.scan(now);
      await running.reduce<Promise<void>>(
        (previous, { bot, version }) =>
          previous.then(() =>
            version ? this.runBot(bot, version, now) : undefined,
          ),
        Promise.resolve(),
      );
    } catch (error) {
      this.logger.error(`봇 주기 실패: ${String(error)}`);
    } finally {
      this.isCycling = false;
    }
  }

  // 후보를 다시 받고 보유 종목과 함께 시세를 구독해요. 실패하면 이전 후보를 그대로 써요
  private async scan(now: Date): Promise<void> {
    if (now.getTime() - this.scannedAt < BotRunnerService.SCAN_MS) return;
    this.scannedAt = now.getTime();
    try {
      this.ranked = await this.scanner.rankByTradingAmount();
    } catch (error) {
      this.logger.warn(`거래대금 순위를 받지 못했어요: ${String(error)}`);
    }
    const held = (await this.positions.findHeldByBot()).map(
      ({ symbol }) => symbol,
    );
    const candidates = this.ranked.map(({ symbol }) => symbol);
    this.collector.watch(held, candidates);
    this.scanner.forget(new Set([...held, ...candidates]));
  }

  // 봇 하나의 예외는 그 봇만 멈춰요. 같은 오류가 주기마다 주문을 반복하지 않게 해요
  private async runBot(
    bot: Bot,
    version: BotVersion,
    now: Date,
  ): Promise<void> {
    try {
      const params: DayTradingParams = {
        ...DAY_TRADING_DEFAULTS,
        ...paramsSchema.parse(version.params),
      };
      const held = await this.positions.findHeldByBot(bot.id);
      const isRunning = bot.status === 'running';
      if (isRunning && (await this.isLimitHit(bot, version, held, now))) return;
      await this.tryExits(version, params, held, now);
      if (isRunning) await this.tryEntry(bot, version, params, held, now);
    } catch (error) {
      this.logger.error(`봇 ${bot.id} 주기 예외: ${String(error)}`);
      this.engineState.blockBot(bot.id, 'bot_error');
      await this.bots.setStatus(bot.id, 'paused', 'bot_error');
      await this.risk.record('bot_error', bot.id, { error: String(error) });
    }
  }

  // ③ POL-RISK-02~04: 손실 한도(실현 + 보유분 평가)와 연속 손절. 걸리면 봇을 멈추고 설정대로 청산해요
  private async isLimitHit(
    bot: Bot,
    version: BotVersion,
    held: Position[],
    now: Date,
  ): Promise<boolean> {
    const allocation = await this.fund.activeAllocation(bot.id);
    if (!allocation) return false;
    const [total, daily] = await Promise.all([
      this.positions.botHoldings([{ botId: bot.id, since: allocation.since }]),
      this.positions.botHoldings([
        { botId: bot.id, since: kstAt(kstDate(now), '00:00') },
      ]),
    ]);
    // 시세가 없는 종목은 평가 손익을 0으로 봐요
    const unrealized = held.reduce((sum, position) => {
      const price = this.collector.snapshot(position.symbol)?.price;
      return price === undefined
        ? sum
        : sum + price * position.quantity - position.costBasis;
    }, 0);
    const dailyPnl = (daily.get(bot.id)?.realizedPnl ?? 0) + unrealized;
    const totalPnl = (total.get(bot.id)?.realizedPnl ?? 0) + unrealized;
    const verdict = checkLossLimits({
      amount: allocation.amount,
      dailyPnl,
      totalPnl,
      dailyLossPct: version.dailyLossPct,
      totalLossPct: version.totalLossPct,
    });
    if (verdict !== 'ok') {
      await this.risk.stopBot(bot.id, verdict, {
        amount: allocation.amount,
        dailyPnl,
        totalPnl,
      });
      if (verdict === 'total_stop' || version.onDailyLimit === 'liquidate')
        await this.orders.liquidate('loss_limit', bot.id);
      return true;
    }
    // ponytail: 마지막 상태 변경(재개) 뒤에 닫힌 포지션만 세요. 투자금 설정만 바꿔도 처음부터 다시 세요
    const reasons = await this.positions.recentExitReasons(
      bot.id,
      bot.updatedAt,
      version.stopStreak,
    );
    if (!isStopStreakHit(reasons, version.stopStreak)) return false;
    await this.risk.stopBot(bot.id, 'streak_pause', {
      stopStreak: version.stopStreak,
    });
    return true;
  }

  // ⑦ 청산 판단. 미체결 주문이 있는 포지션은 결과를 기다려요. 손절은 조건주문이 맡아요
  private async tryExits(
    version: BotVersion,
    params: DayTradingParams,
    held: Position[],
    now: Date,
  ): Promise<void> {
    const nowKst = kstTime(now);
    await held.reduce<Promise<void>>(
      (previous, position) =>
        previous.then(async () => {
          if (position.quantity === 0) return;
          const price = this.collector.snapshot(position.symbol)?.price;
          if (price === undefined) return;
          const { hasOpenOrders, takenSteps } = await this.orders.exitState(
            position.id,
          );
          if (hasOpenOrders) return;
          // VWAP를 모르면 VWAP 이탈은 보지 않아요
          const stats = await this.scanner.intradayStats(position.symbol);
          const signal = evaluateExit(params, {
            price,
            vwap: stats?.vwap ?? price,
            avgPrice: position.costBasis / position.quantity,
            takenSteps,
            nowKst,
          });
          if (signal.action === 'hold') return;
          await this.orders.exit({
            positionId: position.id,
            botVersionId: version.id,
            reason: EXIT_REASON[signal.reason],
            orderType: 'MARKET',
            price: null,
            markPrice: price,
            quantity: Math.max(Math.floor(position.quantity * signal.ratio), 1),
            rationale: { passed: [signal.check], failed: [], score: null },
          });
        }),
      Promise.resolve(),
    );
  }

  // ①~⑤: 후보 중 진입 조건을 모두 충족한 첫 종목 하나만 진입을 시도해요
  private async tryEntry(
    bot: Bot,
    version: BotVersion,
    params: DayTradingParams,
    held: Position[],
    now: Date,
  ): Promise<void> {
    const nowKst = kstTime(now);
    const isWindow = isTradingWindow({
      isRegularSession: true,
      nowKst,
      botStart: bot.tradingStart,
      // 장 마감 전 청산 시각부터는 신규 진입하지 않아요
      botEnd: bot.tradingEnd < params.exitAt ? bot.tradingEnd : params.exitAt,
    });
    if (!isWindow || !this.engineState.canEnter(bot.id)) return;
    if (held.length >= version.maxPositions) return;
    const budget = await this.fund.entryBudget(bot.id, {
      type: version.orderSizeType,
      value: version.orderSizeValue,
    });
    // 확정 투자금이 없어요. 자금 대기는 배분(FundService)이 알려요
    if (budget === 0) return;

    // 보유 중인 종목과 재진입 대기 중(최근 청산)인 종목은 사지 않아요
    const cooling = await this.positions.findClosedSymbolsSince(
      bot.id,
      new Date(now.getTime() - params.reentryCooldownMinutes * MINUTE_MS),
    );
    const candidate = await this.findCandidate(
      params,
      new Set([...held.map(({ symbol }) => symbol), ...cooling]),
    );
    if (!candidate) return;
    const { symbol, price, evaluation } = candidate;
    const rationale = {
      passed: evaluation.passed,
      failed: evaluation.failed,
      score: evaluation.score,
    };
    const base: SkipBase = {
      botVersionId: version.id,
      symbol,
      price,
      ...rationale,
    };

    // POL-RISK-06: 진입 직전에 매수 유의사항·거래정지를 확인해요
    if (entryBanReason(await this.scanner.stockStatus(symbol)) !== null)
      return this.skip(bot.id, base, 'market_alert', now);
    const quantity = Math.floor(budget / price);
    if (quantity < 1) return this.skip(bot.id, base, 'funds', now);
    await this.orders.enter({
      botId: bot.id,
      botVersionId: version.id,
      symbol,
      price,
      quantity,
      rationale: {
        ...rationale,
        direction: 'up',
        ...entryPlan(params, price, nowKst),
      },
    });
  }

  // 거래대금 순위대로 보면서 진입 조건을 모두 충족한 첫 종목. 제외 종목과 순위 밖은 보지 않아요
  private findCandidate(
    params: DayTradingParams,
    excluded: Set<string>,
  ): Promise<Candidate | undefined> {
    return this.ranked.reduce<Promise<Candidate | undefined>>(
      (previous, { symbol, rank }) =>
        previous.then(async (found) => {
          if (found || excluded.has(symbol) || rank > params.maxRank)
            return found;
          const snapshot = this.collector.snapshot(symbol);
          if (snapshot?.price === undefined) return undefined;
          const stats = await this.scanner.intradayStats(symbol);
          if (!stats) return undefined;
          const evaluation = evaluateEntry(params, {
            price: snapshot.price,
            openPrice: stats.openPrice,
            vwap: stats.vwap,
            rank,
          });
          if (!evaluation.isEntry) return undefined;
          return {
            symbol,
            price: snapshot.asks[0]?.price ?? snapshot.price,
            evaluation,
          };
        }),
      Promise.resolve(undefined),
    );
  }

  // FR-RAT-03: 리스크·자금 검사에서 막힌 진입을 건너뛴 판단으로 남겨요
  private async skip(
    botId: number,
    base: SkipBase,
    reason: SkipReason,
    now: Date,
  ): Promise<void> {
    const key = `${kstDate(now)}:${botId}:${base.symbol}:${reason}`;
    if (this.skipped.has(key)) return;
    await this.decisions.record({
      ...base,
      positionId: null,
      kind: 'skip',
      direction: null,
      targetPrice: null,
      stopPrice: null,
      horizonMinutes: null,
      skipReason: reason,
    });
    this.skipped.add(key);
  }
}
