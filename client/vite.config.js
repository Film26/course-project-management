import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The browser only talks to /api on its own origin; Vite proxies it to Express in development,
// so the session cookie stays same-origin (no CORS, no token in JavaScript).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
