import { Global, Module } from '@nestjs/common';

import { TossClient } from './toss.client.js';

// engine 진입점(EngineAppModule)만 가져와요. api(AppModule)는 토스를 부르지 않아요(ADR-0002).
// feature module은 infra를 가져올 수 없어서 전역으로 둬요. service는 TossClient를 생성자로 받아요.
@Global()
@Module({
  providers: [TossClient],
  exports: [TossClient],
})
export class TossModule {}
