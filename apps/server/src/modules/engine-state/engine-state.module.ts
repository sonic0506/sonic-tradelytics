import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EngineStateService } from './engine-state.service.js';
import { EngineStatusRepository } from './engine-status.repository.js';
import { EngineStatusService } from './engine-status.service.js';
import { EngineStatus } from './entities/engine-status.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([EngineStatus])],
  providers: [EngineStateService, EngineStatusService, EngineStatusRepository],
  exports: [EngineStateService, EngineStatusService],
})
export class EngineStateModule {}
