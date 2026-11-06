// Runs once before the suite: apply all migrations to the test database.
import { execSync } from 'node:child_process';
import dotenv from 'dotenv';

export default function setup() {
  const env = dotenv.config({ path: '.env.test', override: true }).parsed;
  if (!env?.DATABASE_URL?.includes('test')) {
    throw new Error('server/.env.test must define a DATABASE_URL whose database name contains "test"');
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, ...env } });
}
