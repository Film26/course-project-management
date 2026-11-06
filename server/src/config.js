import 'dotenv/config';

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
