import { Module } from '@nestjs/common';

import { MarketDataModule } from '@/modules/market-data/index.js';

import { EngineLifecycleService } from './engine-lifecycle.service.js';

// engine 진입점에만 들어가요. EngineLock·TossClient는 EngineAppModule이 전역으로 넣어요.
@Module({
  imports: [MarketDataModule],
  providers: [EngineLifecycleService],
})
export class EngineModule {}
