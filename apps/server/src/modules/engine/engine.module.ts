import { Module } from '@nestjs/common';

import { AccountModule } from '@/modules/account/index.js';
import { CommandModule } from '@/modules/command/index.js';
import { EngineStateModule } from '@/modules/engine-state/index.js';
import { MarketDataModule } from '@/modules/market-data/index.js';

import { EngineLifecycleService } from './engine-lifecycle.service.js';

// engine 진입점에만 들어가요. EngineLock·TossClient는 EngineAppModule이 전역으로 넣어요.
@Module({
  imports: [AccountModule, CommandModule, EngineStateModule, MarketDataModule],
  providers: [EngineLifecycleService],
})
export class EngineModule {}
