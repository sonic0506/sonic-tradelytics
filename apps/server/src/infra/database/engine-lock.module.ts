import { Global, Module } from '@nestjs/common';

import { EngineLock } from './engine-lock.js';

// engine 진입점(EngineAppModule)만 가져와요. feature module은 infra를 가져올 수 없어서 전역으로 둬요.
@Global()
@Module({
  providers: [EngineLock],
  exports: [EngineLock],
})
export class EngineLockModule {}
