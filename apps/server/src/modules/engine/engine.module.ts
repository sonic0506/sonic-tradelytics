import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from '@/modules/account/index.js';
import { CommandModule } from '@/modules/command/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { MarketDataModule } from '@/modules/market-data/index.js';
import { NotificationModule } from '@/modules/notification/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { BatchRunRepository } from './batch-run.repository.js';
import { EngineLifecycleService } from './engine-lifecycle.service.js';
import { EngineScheduleService } from './engine-schedule.service.js';
import { BatchRun } from './entities/batch-run.entity.js';
import { StatusReporterService } from './status-reporter.service.js';

// engine 진입점에만 들어가요. EngineLock·TossClient·TelegramClient는 EngineAppModule이 전역으로 넣어요.
@Module({
  imports: [
    TypeOrmModule.forFeature([BatchRun]),
    AccountModule,
    CommandModule,
    EngineStateModule,
    MarketDataModule,
    NotificationModule,
    RiskModule,
  ],
  providers: [
    EngineLifecycleService,
    EngineScheduleService,
    BatchRunRepository,
    StatusReporterService,
  ],
})
export class EngineModule {}
