// Start the API for Playwright E2E tests against its own database (server/.env.e2e → cpms_e2e).
// Refuses to run unless the database name contains "e2e", so E2E tests can never reset cpms_dev.
// Steps: apply migrations → seed synthetic accounts → start the API. Cross-platform (no shell env syntax).
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

process.env.NODE_ENV = 'e2e';
const env = dotenv.config({ path: '.env.e2e', override: true, quiet: true }).parsed;
const dbName = env?.DATABASE_URL ? new URL(env.DATABASE_URL).pathname.slice(1) : '';
if (!dbName.includes('e2e')) {
  console.error('server/.env.e2e must define a DATABASE_URL whose database name contains "e2e" (e.g. cpms_e2e).');
  process.exit(1);
}

const childEnv = { ...process.env, ...env, NODE_ENV: 'e2e' };
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: childEnv });
execSync('node prisma/seed.js', { stdio: 'inherit', env: childEnv });
await import('../src/server.js');
