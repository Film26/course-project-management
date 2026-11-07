// Runs before every test file: point the app at the separate test database.
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true, quiet: true });
process.env.NODE_ENV = 'test';
