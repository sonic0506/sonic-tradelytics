import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { configureApp, createOpenApiDocument } from './app.setup.js';
import { env } from './config/env.js';

const app = await NestFactory.create(AppModule, { bufferLogs: true });
configureApp(app);
if (env.NODE_ENV !== 'production')
  SwaggerModule.setup('docs', app, createOpenApiDocument(app));
await app.listen(env.PORT);
