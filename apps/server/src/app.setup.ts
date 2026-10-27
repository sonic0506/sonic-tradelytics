import {
  HttpStatus,
  type INestApplication,
  ValidationPipe,
  type VersioningOptions,
  VersioningType,
} from '@nestjs/common';
import {
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import { useContainer } from 'class-validator';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module.js';
import { addErrorResponses } from './common/exceptions/api-errors.js';
import { AppException } from './common/exceptions/app.exception.js';
import { ProblemDetailsDto } from './common/exceptions/problem-details.dto.js';
import { env } from './config/env.js';

// 모든 경로는 /v1/... 이에요. OpenAPI 스크립트(scripts/openapi.mjs)도 이 값을 써요.
export const VERSIONING: VersioningOptions = {
  type: VersioningType.URI,
  defaultVersion: '1',
};

// main.ts와 e2e 테스트가 같은 설정으로 앱을 띄우도록 여기에 모아요.
export function configureApp(app: INestApplication): void {
  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableVersioning(VERSIONING);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new AppException(
          'VALIDATION_FAILED',
          HttpStatus.BAD_REQUEST,
          '요청 값이 올바르지 않아요.',
          errors.map((error) => ({
            field: error.property,
            messages: Object.values(error.constraints ?? {}),
          })),
        ),
    }),
  );
  app.enableShutdownHooks();
  // @IsCommonCode 같은 검증기가 Nest DI로 service를 받게 해요.
  useContainer(app.select(AppModule), { fallbackOnErrors: true });
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1')
    .addBearerAuth()
    .addSecurityRequirements('bearer')
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ProblemDetailsDto],
  });
  // 에러 응답(RFC 9457)과 예시: 공통 400·401·403은 자동, 비즈니스 예외는 @ApiErrors로 적어요.
  addErrorResponses(document);
  return document;
}
