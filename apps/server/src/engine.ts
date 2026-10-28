import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { EngineAppModule } from './engine-app.module.js';

// 매매 engine 진입점 (ADR-0002). HTTP를 열지 않는 application context예요.
// SIGTERM(재배포)이면 종료 훅으로 잠금을 풀고 내려가요 (docs/architecture/engine.md 종료 순서).
const app = await NestFactory.createApplicationContext(EngineAppModule, {
  bufferLogs: true,
});
app.useLogger(app.get(Logger));
app.enableShutdownHooks();
