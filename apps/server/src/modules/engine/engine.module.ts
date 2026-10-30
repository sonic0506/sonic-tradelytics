import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AccountModule } from '@/modules/account/index.js';
import { BotModule } from '@/modules/bot/index.js';
import { CommandModule } from '@/modules/command/index.js';
import { DecisionModule } from '@/modules/decision/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { FundModule } from '@/modules/fund/index.js';
import { MarketDataModule } from '@/modules/market-data/index.js';
import { NotificationModule } from '@/modules/notification/index.js';
import { OrderModule } from '@/modules/order/index.js';
import { PositionModule } from '@/modules/position/index.js';
import { RiskModule } from '@/modules/risk/index.js';

import { BatchRunRepository } from './batch-run.repository.js';
import { BotRunnerService } from './bot-runner.service.js';
import { EngineLifecycleService } from './engine-lifecycle.service.js';
import { EngineScheduleService } from './engine-schedule.service.js';
import { BatchRun } from './entities/batch-run.entity.js';
import { StatusReporterService } from './status-reporter.service.js';

// engine 진입점에만 들어가요. EngineLock·TossClient·TelegramClient는 EngineAppModule이 전역으로 넣어요.
@Module({
  imports: [
    TypeOrmModule.forFeature([BatchRun]),
    AccountModule,
    BotModule,
    CommandModule,
    DecisionModule,
    EngineStateModule,
    FundModule,
    MarketDataModule,
    NotificationModule,
    OrderModule,
    PositionModule,
    RiskModule,
  ],
  providers: [
    BotRunnerService,
    EngineLifecycleService,
    EngineScheduleService,
    BatchRunRepository,
    StatusReporterService,
  ],
})
export class EngineModule {}
