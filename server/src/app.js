import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { config } from './config.js';
import { prisma } from './db.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { coursesRouter } from './routes/courses.js';
import { proposalsRouter, teamsRouter } from './routes/proposals.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Lab 5: readiness = the API can reach the database (used by the smoke test after every deploy).
  app.get('/api/ready', async (req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ready', db: 'connected' });
    } catch {
      res.status(503).json({ status: 'not_ready', db: 'unreachable' });
    }
  });

  // Lab 5 (R-08): which commit is running. Not secret — it is the public Git SHA.
  app.get('/api/version', (req, res) => res.json({ commit: config.appCommit }));

  app.use('/api/auth', authRouter); // F-01
  app.use('/api/courses', coursesRouter); // F-01 roster, F-02 course proposals / my team
  app.use('/api/teams', teamsRouter); // F-02 create proposal
  app.use('/api/proposals', proposalsRouter); // F-02 view / edit / submit / decide

  app.use('/api', notFoundHandler);

  // Lab 5: in the container one process serves the built UI and the API on the same origin,
  // so the session cookie stays same-origin exactly as with the Vite proxy in development.
  if (config.clientDistDir && fs.existsSync(path.join(config.clientDistDir, 'index.html'))) {
    app.use(express.static(config.clientDistDir, { index: 'index.html' }));
    app.get(/^(?!\/api\/).*/, (req, res) => res.sendFile(path.join(config.clientDistDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
