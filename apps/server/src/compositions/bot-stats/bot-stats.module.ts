import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { FundQueryModule } from '@/modules/fund/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { BotStatsController } from './bot-stats.controller.js';
import { BotStatsService } from './bot-stats.service.js';

// 봇 비교 화면. 읽기 전용 모듈이라 토스가 필요 없어요
@Module({
  imports: [BotModule, FundQueryModule, PositionModule],
  controllers: [BotStatsController],
  providers: [BotStatsService],
})
export class BotStatsModule {}
