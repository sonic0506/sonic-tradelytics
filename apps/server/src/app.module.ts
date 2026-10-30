import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { ClsModule } from 'nestjs-cls';
import { LoggerModule } from 'nestjs-pino';

import { JwtAuthGuard } from './common/auth/jwt-auth.guard.js';
import { RolesGuard } from './common/auth/roles.guard.js';
import { AppExceptionFilter } from './common/filters/app-exception.filter.js';
import { env } from './config/env.js';
import { dataSourceOptions } from './infra/database/data-source.js';
import { HealthModule } from './infra/health/health.module.js';
import { CommandApiModule } from './modules/command/index.js';
import { EngineStateModule } from './modules/engine-state/index.js';
import { RiskModule } from './modules/risk/index.js';

const REQUEST_ID = /^[\w-]{1,128}$/;

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.NODE_ENV === 'test' ? 'silent' : 'info',
        // 요청마다 ID를 정해 로그·에러 응답·X-Request-Id 헤더에 같이 남겨요.
        genReqId: (req, res) => {
          const header = req.headers['x-request-id'];
          const id =
            typeof header === 'string' && REQUEST_ID.test(header)
              ? header
              : randomUUID();
          res.setHeader('X-Request-Id', id);
          return id;
        },
        // 민감정보는 로그에 남기지 않아요.
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.password',
          '*.token',
          '*.accessToken',
          '*.refreshToken',
        ],
      },
    }),
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: [],
      migrations: [],
      autoLoadEntities: true,
    }),
    // @Transactional()이 쓰는 요청 단위 컨텍스트예요.
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
      plugins: [
        new ClsPluginTransactional({
          imports: [TypeOrmModule],
          adapter: new TransactionalAdapterTypeOrm({
            dataSourceToken: getDataSourceToken(),
          }),
        }),
      ],
    }),
    // 알고리즘을 고정하고, 발급하는 토큰에는 만료(exp)를 붙여요.
    JwtModule.register({
      global: true,
      secret: env.JWT_SECRET,
      signOptions: {
        algorithm: 'HS256',
        expiresIn: env.JWT_EXPIRES_IN_SECONDS,
      },
      verifyOptions: { algorithms: ['HS256'] },
    }),
    ThrottlerModule.forRoot([
      { ttl: env.THROTTLE_TTL_MS, limit: env.THROTTLE_LIMIT },
    ]),
    HealthModule,
    // feature 모듈은 여기에 더해요: import { UserModule } from './modules/user/index.js';
    CommandApiModule,
    EngineStateModule,
    RiskModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AppExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
