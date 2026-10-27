import { defineConfig } from 'vitest/config';

// e2e는 Testcontainers Postgres 하나를 쓰고, 파일마다 resetDatabase로 비워요.
// ponytail: 파일을 순서대로 돌려요. 느려지면 worker마다 스키마를 나눠요.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    setupFiles: ['./test/setup/msw.ts'],
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
