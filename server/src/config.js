import dotenv from 'dotenv';
import { envFileFor } from './envFile.js';

// The project's own env file always wins over machine-wide variables, so a DATABASE_URL
// left over from another project can never point this app at the wrong database.
dotenv.config({ path: envFileFor(process.env.NODE_ENV), override: true, quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 8),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
};
