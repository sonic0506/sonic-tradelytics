import { Injectable } from '@nestjs/common';

import type { PageQueryDto } from '@/common/pagination/page-query.dto.js';
import { kstAt, kstDate, kstTime } from '@/common/time/kst-date.js';
import {
  type Bot,
  botActivity,
  BotNotFoundException,
  BotService,
  isResting,
  nextRunDate,
  notRestingReasons,
} from '@/modules/bot/index.js';
import { FundQueryService } from '@/modules/fund/index.js';
import {
  MarketCalendarQueryService,
  QuoteQueryService,
} from '@/modules/market-data/index.js';
import { PositionService } from '@/modules/position/index.js';

import type { BotOverview, BotOverviewDetail } from './dto/bot-overview.dto.js';

// controller의 @ApiErrors가 쓰도록 다시 내보내요 (composition controller는 feature를 직접 가져오지 않아요)
export { BotNotFoundException } from '@/modules/bot/index.js';

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

    return bots.map((bot) => {
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
        nextRunAt:
          runDate === null
            ? null
            : kstAt(runDate, bot.tradingStart.slice(0, HH_MM)),
      };
    });
  }
}
