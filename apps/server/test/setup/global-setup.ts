import { execFileSync } from 'node:child_process';

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer | undefined;

// e2e 전체에서 Postgres 하나를 띄우고, 빌드된 migration을 적용해요(실제 스키마로 테스트해요).
export async function setup(): Promise<void> {
  container = await new PostgreSqlContainer('postgres:17-alpine').start();
  Object.assign(process.env, {
    NODE_ENV: 'test',
    TZ: 'UTC',
    DATABASE_URL: container.getConnectionUri(),
    JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
    THROTTLE_LIMIT: '10000',
  });
  execFileSync(
    'node',
    [
      'node_modules/typeorm/cli.js',
      '-d',
      'dist/infra/database/data-source.js',
      'migration:run',
    ],
    { stdio: 'inherit', env: process.env },
  );
}

export async function teardown(): Promise<void> {
  await container?.stop();
}
