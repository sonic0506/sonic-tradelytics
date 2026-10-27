import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '@/app.module.js';
import { configureApp } from '@/app.setup.js';
import type { AuthUser } from '@/common/auth/roles.js';

import { SEED_TABLES } from './seed-tables.js';

export async function createTestApp(
  imports: ModuleMetadata['imports'] = [],
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...imports],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

// 테스트 파일마다 DB를 비워 서로 영향을 주지 않게 해요. seed 테이블(SEED_TABLES)은 남겨요.
export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const tables = dataSource.entityMetadatas
    .map((meta) => meta.tableName)
    .filter((table) => !SEED_TABLES.includes(table))
    .map((table) => `"${table}"`);
  if (tables.length)
    await dataSource.query(
      `TRUNCATE ${tables.join(', ')} RESTART IDENTITY CASCADE`,
    );
}

export function bearer(
  app: INestApplication,
  user: Pick<AuthUser, 'sub' | 'roles'> = { sub: '1', roles: ['user'] },
): string {
  return `Bearer ${app.get(JwtService).sign(user)}`;
}
