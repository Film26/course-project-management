import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only talks to /api on its own origin; Vite proxies it to Express in development,
// so the session cookie stays same-origin (no CORS, no token in JavaScript).
// API_TARGET lets the Playwright E2E run point the UI at the separate E2E API (see playwright.config.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': process.env.API_TARGET ?? 'http://localhost:3000' },
  },
});
