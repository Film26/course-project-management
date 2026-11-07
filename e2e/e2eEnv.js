// Shared E2E settings, read from server/.env.e2e (the E2E database, never cpms_dev).
import dotenv from 'dotenv';

const env = dotenv.config({ path: 'server/.env.e2e', quiet: true }).parsed ?? {};

export const SEED_PASSWORD = env.SEED_PASSWORD;
export const DATABASE_URL = env.DATABASE_URL;

/** Throw unless server/.env.e2e exists and points at a database whose name contains "e2e". */
export function assertE2eDatabase() {
  const dbName = DATABASE_URL ? new URL(DATABASE_URL).pathname.slice(1) : '';
  if (!dbName.includes('e2e')) {
    throw new Error('server/.env.e2e must point DATABASE_URL at the E2E database (name containing "e2e"), not cpms_dev');
  }
  if (!SEED_PASSWORD) throw new Error('SEED_PASSWORD missing in server/.env.e2e');
}
