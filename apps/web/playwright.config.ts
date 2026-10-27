import { defineConfig } from '@playwright/test';

// PORT: Vite 5173, Next 3000
const PORT = Number(process.env.PORT ?? 5173);

export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: { command: 'npm run dev', port: PORT, reuseExistingServer: true },
});
