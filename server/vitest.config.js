import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/globalSetup.js'],
    setupFiles: ['./tests/setupEnv.js'],
    // API/DB integration tests share one test database, so run files one at a time.
    fileParallelism: false,
  },
});
