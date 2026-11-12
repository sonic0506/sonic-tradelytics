import { Injectable } from '@nestjs/common';

import { kstRange } from '@/common/time/kst-date.js';
import { BotService } from '@/modules/bot/index.js';
import { DecisionService } from '@/modules/decision/index.js';

import type {
  AccuracyStatsDto,
  AccuracyStatsQueryDto,
} from './dto/accuracy-stats.dto.js';

// 정확도 분석 화면 (F3). 채점 요약은 decision이 계산하고, 봇 이름만 붙여요
@Injectable()
export class AccuracyService {
  constructor(
    private readonly decisions: DecisionService,
    private readonly bots: BotService,
  ) {}

  async stats(query: AccuracyStatsQueryDto): Promise<AccuracyStatsDto> {
    const [accuracy, options] = await Promise.all([
      this.decisions.accuracy({
        ...kstRange(query.from, query.to),
        botIds: query.botIds?.map(Number),
      }),
      this.bots.findOptions(),
    ]);
    const names = new Map(options.map(({ id, name }) => [id, name]));
    const { overall, byBot, buckets } = accuracy;
    return {
      summary: {
        scoredCount: overall.scoredCount,
        directionHitRate: overall.directionHitRate,
        targetReachRate: overall.targetReachRate,
        bots: [...byBot].map(([botId, rates]) => ({
          botId: String(botId),
          name: names.get(botId) ?? String(botId),
          ...rates,
        })),
      },
      scoreBuckets: buckets,
    };
  }
}
