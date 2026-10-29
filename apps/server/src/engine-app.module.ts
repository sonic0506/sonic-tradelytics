import { Module } from '@nestjs/common';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { env } from './config/env.js';
import { dataSourceOptions } from './infra/database/data-source.js';
import { EngineLockModule } from './infra/database/engine-lock.module.js';
import { TelegramModule } from './infra/telegram/telegram.module.js';
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
    // @Transactional()이 쓰는 컨텍스트예요. HTTP 요청이 없어서 미들웨어 없이 @Transactional()이 직접 열어요
    ClsModule.forRoot({
      global: true,
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({
            dataSourceToken: getDataSourceToken(),
          }),
        }),
      ],
    }),
    EngineLockModule,
    TossModule,
    TelegramModule,
    EngineModule,
  ],
})
export class EngineAppModule {}
