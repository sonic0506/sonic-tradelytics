import { Module } from '@nestjs/common';

import { BotModule } from '@/modules/bot/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { FundQueryModule } from '@/modules/fund/index.js';
import { OrderQueryModule } from '@/modules/order/index.js';
import { PositionModule } from '@/modules/position/index.js';

import { HomeController } from './home.controller.js';
import { HomeService } from './home.service.js';

// 홈 대시보드. 모두 읽기 전용 모듈이라 토스가 필요 없어요
@Module({
  imports: [
    BotModule,
    EngineStateModule,
    FundQueryModule,
    OrderQueryModule,
    PositionModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
