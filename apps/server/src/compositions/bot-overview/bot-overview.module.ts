import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { FundQueryModule } from '@/modules/fund/index.js';
import { MarketDataQueryModule } from '@/modules/market-data/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { BotOverviewController } from './bot-overview.controller.js';
import { BotOverviewService } from './bot-overview.service.js';

// 봇 목록·상세 화면. 모두 읽기 전용 모듈이라 토스가 필요 없어요
@Module({
  imports: [BotModule, FundQueryModule, MarketDataQueryModule, PositionModule],
  controllers: [BotOverviewController],
  providers: [BotOverviewService],
})
export class BotOverviewModule {}
