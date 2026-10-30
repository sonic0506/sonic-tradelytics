import { defineConfig } from 'vitest/config';

// 리플레이: 지난 장 하루치 시세로 BotRunner·PaperBroker를 미리 돌려 봐요 (REPLAY_FILE 필요, CI에서는 돌지 않아요)
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/replay/**/*.replay-spec.ts'],
    globalSetup: ['./test/setup/global-setup.ts'],
    fileParallelism: false,
    hookTimeout: 300_000,
  },
});
