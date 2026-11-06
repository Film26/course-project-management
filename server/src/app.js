import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './errors.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Feature routers are mounted here, e.g. app.use('/api/auth', authRouter);

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
