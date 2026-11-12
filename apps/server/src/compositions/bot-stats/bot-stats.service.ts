import { Injectable } from '@nestjs/common';

import { BotService } from '@/modules/bot/index.js';
import { FundQueryService } from '@/modules/fund/index.js';
import {
  maxDrawdownPct,
  PositionService,
  returnRatePct,
  tradeStats,
} from '@/modules/position/index.js';

import type { BotStatDto } from './dto/bot-stat.dto.js';

const MANUAL_NAME = '직접 거래';
// ponytail: 봇 수가 적어 한 번에 읽어요 (api.md: 페이지를 나누지 않아요)
const MAX_BOTS = 100;

// 봇 비교 표 (FR-PERF-02). 봇마다 한 줄 + 직접 거래 한 줄. 정렬은 web이 해요
@Injectable()
export class BotStatsService {
  constructor(
    private readonly bots: BotService,
    private readonly funds: FundQueryService,
    private readonly positions: PositionService,
  ) {}

  async stats(range: { from?: string; to?: string }): Promise<BotStatDto[]> {
    const [bots] = await this.bots.findPage(0, MAX_BOTS);
    const [funds, performance] = await Promise.all([
      this.funds.viewsOf(bots.map(({ id }) => id)),
      this.positions.performance(range),
    ]);
    const empty = { trades: tradeStats([]), dailyPnls: [] };
    // ponytail: 수익률·MDD는 지금 살아 있는 확정 투자금으로 나눠요. 기간 중 투자금이 바뀌면 날마다 그날 투자금으로 나눠요
    const botRows = bots.map((bot): BotStatDto => {
      const { trades, dailyPnls } = performance.get(bot.id) ?? empty;
      const amount = funds.get(bot.id)?.amount ?? 0;
      return {
        botId: String(bot.id),
        name: bot.name,
        stage: bot.stage,
        returnRate:
          trades.netPnl === null ? null : returnRatePct(trades.netPnl, amount),
        mdd: maxDrawdownPct(dailyPnls, amount),
        ...trades,
      };
    });
    const manual = (performance.get(null) ?? empty).trades;
    return [
      ...botRows,
      {
        botId: null,
        name: MANUAL_NAME,
        stage: null,
        // 직접 거래는 확정 투자금과 일별 기록이 없어요
        returnRate: null,
        mdd: null,
        ...manual,
      },
    ];
  }
}
