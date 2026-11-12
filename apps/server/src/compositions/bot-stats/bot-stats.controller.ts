import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { BotStatsService } from './bot-stats.service.js';
import { BotStatListDto, BotStatQueryDto } from './dto/bot-stat.dto.js';

@ApiTags('bot-stats')
@Controller('bot-stats')
export class BotStatsController {
  constructor(private readonly botStats: BotStatsService) {}

  /** 봇 비교 표 (FR-PERF-02). 봇마다 한 줄과 직접 거래 한 줄. 지표 정의는 F2 "봇별 핵심 지표" */
  @Get()
  async findAll(@Query() query: BotStatQueryDto): Promise<BotStatListDto> {
    return { items: await this.botStats.stats(query), benchmark: null };
  }
}
