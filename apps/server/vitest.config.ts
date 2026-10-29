import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./test/setup/msw.ts'],
    // src/config/env.ts가 import될 때 검증하는 값이에요. 단위 테스트는 DB에 연결하지 않아서 가짜 값이면 돼요.
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
      JWT_SECRET: 'unit-test-secret-unit-test-secret-unit',
      TOSS_CLIENT_ID: 'test-client-id',
      TOSS_CLIENT_SECRET: 'test-client-secret',
      TOSS_ACCOUNT_SEQ: '1',
      TOSS_API_BASE_URL: 'https://toss.test',
      TOSS_WS_URL: 'wss://toss-ws.test/ws/v1',
      TOSS_TOKEN_FILE: join(tmpdir(), 'tradelytics-unit-toss-token.json'),
    },
    coverage: {
      // compositions service는 위임만 해서 e2e로 확인해요.
      include: ['src/modules/**/*.service.ts'],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
