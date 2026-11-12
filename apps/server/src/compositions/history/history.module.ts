import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { DecisionModule } from '@/modules/decision/index.js';
import { FundQueryModule } from '@/modules/fund/index.js';
import { MarketDataQueryModule } from '@/modules/market-data/index.js';
import { OrderQueryModule } from '@/modules/order/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { HistoryController } from './history.controller.js';
import { HistoryService } from './history.service.js';

// 투자 내역 화면(목록·요약·펼친 줄). 한 화면이라 feature 6개를 조합해요. 모두 읽기 전용 모듈이라 토스가 필요 없어요
@Module({
  imports: [
    BotModule,
    DecisionModule,
    FundQueryModule,
    MarketDataQueryModule,
    OrderQueryModule,
    PositionModule,
  ],
  controllers: [HistoryController],
  providers: [HistoryService],
})
export class HistoryModule {}
