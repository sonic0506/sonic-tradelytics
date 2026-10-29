import { Module } from '@nestjs/common';

import { EngineStateService } from './engine-state.service.js';

@Module({
  providers: [EngineStateService],
  exports: [EngineStateService],
})
export class EngineStateModule {}
