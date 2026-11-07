// E2E tests run the real UI + API against the seeded development database (cpms_dev).
// Prerequisite: npm run db:migrate && npm run db:seed
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm start -w server',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: true,
    },
    {
      command: 'npm run dev -w client',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
    },
  ],
});
