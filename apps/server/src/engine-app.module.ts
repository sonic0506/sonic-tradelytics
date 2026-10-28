import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import { env } from './config/env.js';
import { dataSourceOptions } from './infra/database/data-source.js';
import { EngineLockModule } from './infra/database/engine-lock.module.js';
import { TossModule } from './infra/toss/toss.module.js';
import { EngineModule } from './modules/engine/index.js';

// engine 진입점(engine.ts)의 루트 모듈이에요. HTTP 서버 없이 매매 루프·배치만 돌아요 (ADR-0002).
// 토스 API는 여기서만 불러요. api(AppModule)는 TossModule을 가져오지 않아요.
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'test' ? 'silent' : 'info',
        // 토큰·비밀 값은 로그에 남기지 않아요
        redact: ['*.accessToken', '*.access_token', '*.token', '*.secret'],
      },
    }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: [],
      migrations: [],
      autoLoadEntities: true,
    }),
    EngineLockModule,
    TossModule,
    EngineModule,
  ],
})
export class EngineAppModule {}
