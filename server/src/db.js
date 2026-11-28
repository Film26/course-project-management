import { PrismaClient } from '@prisma/client';
import { config } from './config.js';

// In tests the client also emits query events, so F-08 TEST-08-04 can count the queries of one request (D4).
export const prisma = new PrismaClient({
  datasourceUrl: config.databaseUrl,
  ...(process.env.NODE_ENV === 'test' ? { log: [{ emit: 'event', level: 'query' }] } : {}),
});
