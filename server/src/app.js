import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './errors.js';
import { authRouter } from './routes/auth.js';
import { coursesRouter } from './routes/courses.js';
import { proposalsRouter, teamsRouter } from './routes/proposals.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter); // F-01
  app.use('/api/courses', coursesRouter); // F-01 roster, F-02 course proposals / my team
  app.use('/api/teams', teamsRouter); // F-02 create proposal
  app.use('/api/proposals', proposalsRouter); // F-02 view / edit / submit / decide

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
