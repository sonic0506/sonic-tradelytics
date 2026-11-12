import { Injectable } from '@nestjs/common';

import { kstDate } from '@/common/time/kst-date.js';
import { BotService } from '@/modules/bot/index.js';
import { EngineStatusService } from '@/modules/engine-state/index.js';
import { FundQueryService } from '@/modules/fund/index.js';
import { OrderQueryService } from '@/modules/order/index.js';
import { PositionService } from '@/modules/position/index.js';

import type { HomeBotDto, HomeDto } from './dto/home.dto.js';

// ponytail: 봇 수가 적어 한 번에 읽어요
const MAX_BOTS = 100;
const PERCENT = 100;
const PRECISION = 100;

// 홈 대시보드 (F2, api.md 홈). 계좌·오늘 손익·봇 카드·오늘 체결을 한 번에 줘요
@Injectable()
export class HomeService {
  constructor(
    private readonly bots: BotService,
    private readonly funds: FundQueryService,
    private readonly positions: PositionService,
    private readonly orders: OrderQueryService,
    private readonly engineStatuses: EngineStatusService,
  ) {}

  async summary(now: Date): Promise<HomeDto> {
    const [allBots] = await this.bots.findPage(0, MAX_BOTS);
    const live = allBots.filter(({ status }) => status !== 'stopped');
    const ids = live.map(({ id }) => id);
    const [versions, funds, today, recent, fills, engine] = await Promise.all([
      this.bots.findWithVersions(ids),
      this.funds.viewsOf(ids),
      this.positions.todayPnl(now),
      this.positions.recentBotStats(kstDate(now)),
      this.orders.todayFills(now),
      this.engineStatuses.find(),
    ]);
    const versionOf = new Map(
      versions.map(({ bot, version }) => [bot.id, version?.version ?? 0]),
    );
    const countOf = (status: string) =>
      allBots.filter((bot) => bot.status === status).length;
    const amount = [...today.byOwner.values()].reduce((a, b) => a + b, 0);
    // ponytail: engine이 잔고를 아직 쓰지 않아(engine_statuses의 두 값이 null) 평가금액을 모르면 null이에요
    const evaluationAmount =
      engine?.orderableCash == null || engine.holdingsValue == null
        ? null
        : engine.orderableCash + engine.holdingsValue;

    return {
      account: {
        evaluationAmount,
        orderableAmount: engine?.orderableCash ?? null,
        holdingSymbolCount: today.holdingSymbolCount,
        syncedAt: engine?.accountSyncedAt ?? null,
      },
      todayPnl: {
        amount,
        rate: evaluationAmount
          ? Math.round((amount / evaluationAmount) * PERCENT * PRECISION) /
            PRECISION
          : null,
      },
      botCounts: {
        running: countOf('running'),
        paused: countOf('paused'),
        waitingFunds: countOf('waiting_funds'),
        stopped: countOf('stopped'),
      },
      bots: live.map((bot): HomeBotDto => ({
        id: String(bot.id),
        name: bot.name,
        type: bot.type,
        status: bot.status,
        stage: bot.stage,
        version: versionOf.get(bot.id) ?? 0,
        todayPnl: today.byOwner.get(bot.id) ?? 0,
        todayFills: fills.byBot.get(bot.id) ?? 0,
        winRate30d: recent.get(bot.id)?.winRate30d ?? null,
        budget: funds.get(bot.id)?.amount ?? null,
        budgetSetting: {
          type: bot.budgetType,
          value:
            bot.budgetType === 'ratio'
              ? (bot.budgetRatio ?? 0)
              : (bot.budgetAmount ?? 0),
        },
        last7Days: recent.get(bot.id)?.last7Days ?? [],
      })),
      fills: { total: fills.total, buy: fills.buy, sell: fills.sell },
    };
  }
}
