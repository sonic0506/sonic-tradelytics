import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bot, BotModule, BotVersion } from '@/modules/bot/index.js';
import { MarketDataQueryModule } from '@/modules/market-data/index.js';

import { Position } from './entities/position.entity.js';
import { PositionRepository } from './position.repository.js';
import { PositionService } from './position.service.js';

// relation 대상(Bot)도 등록해야 TypeORM이 Position 메타데이터를 만들어요
@Module({
  imports: [
    TypeOrmModule.forFeature([Position, Bot, BotVersion]),
    BotModule,
    MarketDataQueryModule,
  ],
  providers: [PositionService, PositionRepository],
  exports: [PositionService],
})
export class PositionModule {}
