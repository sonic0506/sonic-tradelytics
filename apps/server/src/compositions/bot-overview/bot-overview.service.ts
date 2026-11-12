import { Injectable } from '@nestjs/common';

import type { PageQueryDto } from '@/common/pagination/page-query.dto.js';
import { kstAt, kstDate, kstTime } from '@/common/time/kst-date.js';
import {
  type Bot,
  botActivity,
  BotNotFoundException,
  BotService,
  type BotVersion,
  BotVersionUnchangedException,
  isResting,
  nextRunDate,
  notRestingReasons,
  releaseCriteria,
  type ReleaseCriterion,
  toTimeOfDay,
  type VersionChange,
  versionChange,
  type VersionValues,
} from '@/modules/bot/index.js';
import { FundQueryService } from '@/modules/fund/index.js';
import {
  MarketCalendarQueryService,
  QuoteQueryService,
} from '@/modules/market-data/index.js';
import { PositionService } from '@/modules/position/index.js';

import type { BotDailyResultDto } from './dto/bot-daily-result.dto.js';
import type { BotOverview, BotOverviewDetail } from './dto/bot-overview.dto.js';
import type {
  BotVersionItemDto,
  CreateBotVersionDto,
  CreatedBotVersionDto,
  VersionPreviewDto,
} from './dto/bot-version.dto.js';

// controller의 @ApiErrors가 쓰도록 다시 내보내요 (composition controller는 feature를 직접 가져오지 않아요)
export {
  BotNotFoundException,
  BotParamsInvalidException,
  BotVersionPendingException,
  BotVersionUnchangedException,
  ReleaseCriteriaNotMetException,
} from '@/modules/bot/index.js';

// "HH:mm:ss" → "HH:mm"
const HH_MM = 5;

// 봇 목록·상세 화면 (F1, F2). 봇·자금·포지션·장 일정 값을 모아요. 판단은 각 feature의 rule·service가 해요
@Injectable()
export class BotOverviewService {
  constructor(
    private readonly bots: BotService,
    private readonly funds: FundQueryService,
    private readonly positions: PositionService,
    private readonly calendars: MarketCalendarQueryService,
    private readonly quotes: QuoteQueryService,
  ) {}

  async findPage(query: PageQueryDto): Promise<[BotOverview[], number]> {
    const [bots, total] = await this.bots.findPage(query.skip, query.size);
    return [await this.overviews(bots, new Date()), total];
  }

  async find(id: number): Promise<BotOverviewDetail> {
    const bot = await this.bots.findById(id);
    if (!bot) throw new BotNotFoundException(id);
    const now = new Date();
    const [overview] = await this.overviews([bot], now);
    if (!overview) throw new BotNotFoundException(id);
    const { funds, version, unrealizedPnl } = overview;
    const ruleFields = version
      ? this.bots.ruleFields(this.bots.parseParams(version.params))
      : [];
    const cumulativePnl = (funds?.realizedPnl ?? 0) + unrealizedPnl;
    return {
      ...overview,
      ruleFields,
      cumulativePnl,
      tradingDays: funds
        ? await this.calendars.countOpenDays(
            kstDate(funds.allocatedAt),
            kstDate(now),
          )
        : 0,
      lossRoom:
        funds && version
          ? this.funds.lossRoom(
              funds.amount,
              version.totalLossPct,
              cumulativePnl,
            )
          : null,
    };
  }

  // 상한 해제 (FR-BOT-06). 화면과 같은 계산으로 기준을 다시 확인해요
  // 봇 하나의 일별 손익과 그날 검증 구간이었는지 (FR-PERF-03, 10)
  async dailyResults(
    id: number,
    range: { from?: string; to?: string },
  ): Promise<BotDailyResultDto[]> {
    const bot = await this.bots.findById(id);
    if (!bot) throw new BotNotFoundException(id);
    const rows = await this.positions.botDailyResults(id, range);
    // ponytail: 해제 시각을 아직 저장하지 않아 지금 단계로 나눠요. 풀린 봇은 해제 전 날도 false예요. releasedAt이 생기면 그 날짜로 나눠요
    const isVerifying = bot.stage === 'verifying';
    return rows.map((row) => ({
      tradeDate: row.tradeDate,
      pnl: row.realizedPnl + row.unrealizedPnl,
      verifying: isVerifying,
    }));
  }

  // 규칙 값 버전 목록, 최신이 앞이에요. 바뀐 값은 바로 앞 버전과 비교해요 (FR-BOT-03)
  async versions(id: number): Promise<BotVersionItemDto[]> {
    if (!(await this.bots.findById(id))) throw new BotNotFoundException(id);
    const versions = await this.bots.findVersions(id);
    return versions.map((version, index) => {
      const previous = versions[index + 1];
      return {
        version: version.version,
        changeKind: version.changeKind,
        changes: previous
          ? versionChange(this.valuesOf(previous), this.valuesOf(version))
              .changes
          : [],
        createdAt: version.createdAt,
        appliedAt: version.appliedAt,
      };
    });
  }

  // 저장하면 어떻게 되는지 (FR-BOT-11). 저장하지 않아요
  async previewVersion(
    id: number,
    request: CreateBotVersionDto,
  ): Promise<VersionPreviewDto> {
    const { bot, change, canApplyNow } = await this.versionPlan(id, request);
    return {
      changeKind: change.changeKind,
      applyTiming: canApplyNow ? 'now' : 'when_resting',
      reconfirmsAtCap:
        change.changeKind === 'decision_change' && bot.stage === 'released',
      changes: change.changes,
    };
  }

  // 새 버전을 추가해요. 쉬는 중(또는 시작 전)이면 바로 적용하고, 아니면 engine이 쉬는 중이 된 뒤 적용해요 (POL-RISK-13)
  async addVersion(
    id: number,
    request: CreateBotVersionDto,
  ): Promise<CreatedBotVersionDto> {
    const { change, canApplyNow, next } = await this.versionPlan(id, request);
    if (change.changeKind === null) throw new BotVersionUnchangedException();
    const saved = await this.bots.addVersion(
      id,
      {
        ...next,
        changeKind: change.changeKind,
        orderSizeType: 'fixed',
      },
      canApplyNow ? new Date() : null,
    );
    return {
      version: saved.version,
      changeKind: saved.changeKind,
      appliedAt: saved.appliedAt,
    };
  }

  private async versionPlan(
    id: number,
    request: CreateBotVersionDto,
  ): Promise<{
    bot: Bot;
    next: VersionValues;
    change: VersionChange;
    canApplyNow: boolean;
  }> {
    const bot = await this.bots.findById(id);
    if (!bot) throw new BotNotFoundException(id);
    const [overview] = await this.overviews([bot], new Date());
    const current = overview?.version;
    if (!overview || !current) throw new BotNotFoundException(id);
    const exitAt = request.params.exitAt;
    const params = this.bots.parseParams({
      ...current.params,
      ...request.params,
      ...(typeof exitAt === 'string' ? { exitAt: toTimeOfDay(exitAt) } : {}),
    });
    const next: VersionValues = {
      params: Object.fromEntries(Object.entries(params)),
      orderSizeValue: request.orderAmount ?? current.orderSizeValue,
      splitCount: request.splitCount ?? current.splitCount,
      maxPositions: request.maxPositions ?? current.maxPositions,
      dailyLossPct: request.lossStop?.first ?? current.dailyLossPct,
      totalLossPct: request.lossStop?.total ?? current.totalLossPct,
      stopStreak: request.stopStreak ?? current.stopStreak,
      onDailyLimit: request.onDailyLimit ?? current.onDailyLimit,
    };
    // 시작 전·자금 대기·종료 봇은 매매하지 않아 바로 적용해요
    const isTrading = bot.status === 'running' || bot.status === 'paused';
    return {
      bot,
      next,
      change: versionChange(this.valuesOf(current), next),
      canApplyNow: !isTrading || overview.resting,
    };
  }

  // 저장된 규칙 값에 기본값을 채워 새 값과 같은 모양으로 비교해요
  private valuesOf(version: BotVersion): VersionValues {
    return {
      params: Object.fromEntries(
        Object.entries(this.bots.parseParams(version.params)),
      ),
      orderSizeValue: version.orderSizeValue,
      splitCount: version.splitCount,
      maxPositions: version.maxPositions,
      dailyLossPct: version.dailyLossPct,
      totalLossPct: version.totalLossPct,
      stopStreak: version.stopStreak,
      onDailyLimit: version.onDailyLimit,
    };
  }

  async release(id: number): Promise<void> {
    const bot = await this.bots.findById(id);
    if (!bot) throw new BotNotFoundException(id);
    if (bot.stage === 'released') return;
    const [[withVersion], funds] = await Promise.all([
      this.bots.findWithVersions([id]),
      this.funds.viewsOf([id]),
    ]);
    const criteria = await this.releaseCriteriaOf(
      bot,
      withVersion?.version ?? null,
      funds.get(id)?.amount,
      new Date(),
    );
    await this.bots.release(id, criteria);
  }

  // 검증 구간 봇의 상한 해제 기준 (POL-RISK-13). 풀린 봇, 버전·투자금이 아직 없는 봇은 빈 목록이에요
  private async releaseCriteriaOf(
    bot: Bot,
    version: BotVersion | null,
    amount: number | undefined,
    now: Date,
  ): Promise<ReleaseCriterion[]> {
    if (bot.stage !== 'verifying' || !version || amount === undefined)
      return [];
    const start = await this.bots.verificationStart(bot.id);
    if (!start) return [];
    const [tradingDays, closedPnls] = await Promise.all([
      this.calendars.countOpenDays(kstDate(start), kstDate(now)),
      this.positions.closedPnlsSince(bot.id, start),
    ]);
    return releaseCriteria({
      tradingDays,
      closedPnls,
      amount,
      totalLossPct: version.totalLossPct,
    });
  }

  private async overviews(bots: Bot[], now: Date): Promise<BotOverview[]> {
    const ids = bots.map(({ id }) => id);
    const today = kstDate(now);
    const nowKst = kstTime(now);
    const [versions, pending, funds, todayHoldings, held, day, nextOpen] =
      await Promise.all([
        this.bots.findWithVersions(ids),
        this.bots.findPendingVersions(ids),
        this.funds.viewsOf(ids),
        this.positions.botHoldings(
          ids.map((botId) => ({ botId, since: kstAt(today, '00:00') })),
        ),
        this.positions.findHeldByBot(),
        this.calendars.findDay(today),
        this.calendars.findNextOpen(today),
      ]);
    const prices = await this.quotes.pricesOf([
      ...new Set(held.map(({ symbol }) => symbol)),
    ]);
    const versionOf = new Map(
      versions.map(({ bot, version }) => [bot.id, version]),
    );
    const isTradingDay = day?.isOpen ?? false;
    const criteria = await Promise.all(
      bots.map((bot) =>
        this.releaseCriteriaOf(
          bot,
          versionOf.get(bot.id) ?? null,
          funds.get(bot.id)?.amount,
          now,
        ),
      ),
    );

    return bots.map((bot, index) => {
      const own = held.filter(({ botId }) => botId === bot.id);
      const unrealizedPnl = own.reduce((sum, position) => {
        const price = prices.get(position.symbol);
        return price === undefined
          ? sum
          : sum + price * position.quantity - position.costBasis;
      }, 0);
      const fundsView = funds.get(bot.id) ?? null;
      const activity = botActivity({
        status: bot.status,
        statusReason: bot.statusReason,
        isTradingDay,
        nowKst,
        tradingStart: bot.tradingStart,
        tradingEnd: bot.tradingEnd,
      });
      const reasons = notRestingReasons({
        status: bot.status,
        activity,
        hasHoldings: own.some(({ quantity }) => quantity > 0),
        hasOpenOrders: fundsView?.hasOpenOrders ?? false,
      });
      const runDate = nextRunDate({
        status: bot.status,
        today,
        isTradingDay,
        nowKst,
        tradingStart: bot.tradingStart,
        periodStart: bot.periodStart,
        nextOpenDate: nextOpen?.tradeDate ?? null,
      });
      return {
        bot,
        version: versionOf.get(bot.id) ?? null,
        pendingVersion: pending.get(bot.id) ?? null,
        funds: fundsView,
        held: own,
        todayPnl: (todayHoldings.get(bot.id)?.realizedPnl ?? 0) + unrealizedPnl,
        unrealizedPnl,
        activity,
        notRestingReasons: reasons,
        resting: isResting(bot.status, reasons),
        releaseCriteria: criteria[index] ?? [],
        nextRunAt:
          runDate === null
            ? null
            : kstAt(runDate, bot.tradingStart.slice(0, HH_MM)),
      };
    });
  }
}
