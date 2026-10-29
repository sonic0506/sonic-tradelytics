import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BotVersion } from '@/modules/bot/index.js';
import { Position } from '@/modules/position/index.js';

import { DecisionRepository } from './decision.repository.js';
import { DecisionService } from './decision.service.js';
import { Decision } from './entities/decision.entity.js';

// relation 대상(BotVersion, Position)도 등록해야 TypeORM이 Decision 메타데이터를 만들어요
@Module({
  imports: [TypeOrmModule.forFeature([Decision, BotVersion, Position])],
  providers: [DecisionService, DecisionRepository],
  exports: [DecisionService],
})
export class DecisionModule {}
