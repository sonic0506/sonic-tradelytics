import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Bot } from '@/modules/bot/index.js';

import { RiskEvent } from './entities/risk-event.entity.js';
import { RiskRepository } from './risk.repository.js';
import { RiskService } from './risk.service.js';

// relation 대상(Bot)도 등록해야 TypeORM이 RiskEvent 메타데이터를 만들어요
@Module({
  imports: [TypeOrmModule.forFeature([RiskEvent, Bot])],
  providers: [RiskService, RiskRepository],
  exports: [RiskService],
})
export class RiskModule {}
