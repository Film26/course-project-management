// E2E tests run the real UI + API against a SEPARATE database, cpms_e2e (server/.env.e2e), never cpms_dev.
// The API runs on port 3100 and the UI on 5174, so a dev server on 3000/5173 is never reused by accident.
// Prerequisite: create the cpms_e2e database and server/.env.e2e (see README). Migrations + seed run automatically.
import { defineConfig } from '@playwright/test';

const API_PORT = 3100;
const UI_PORT = 5174;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${UI_PORT}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run start:e2e -w server',
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -w client -- --port ${UI_PORT} --strictPort`,
      url: `http://localhost:${UI_PORT}`,
      reuseExistingServer: false,
      env: { API_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
