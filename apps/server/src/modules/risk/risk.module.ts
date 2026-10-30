import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bot, BotModule } from '@/modules/bot/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';

import { RiskEvent } from './entities/risk-event.entity.js';
import { SymbolLock } from './entities/symbol-lock.entity.js';
import { RiskRepository } from './risk.repository.js';
import { RiskService } from './risk.service.js';
import { RiskEventController } from './risk-event.controller.js';
import { SymbolLockRepository } from './symbol-lock.repository.js';

// relation 대상(Bot)도 등록해야 TypeORM이 RiskEvent 메타데이터를 만들어요
@Module({
  imports: [
    TypeOrmModule.forFeature([RiskEvent, SymbolLock, Bot]),
    BotModule,
    EngineStateModule,
  ],
  controllers: [RiskEventController],
  providers: [RiskService, RiskRepository, SymbolLockRepository],
  exports: [RiskService],
})
export class RiskModule {}
