import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();

afterAll(() => prisma.$disconnect());

describe('baseline', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown API route returns the standard error shape', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
  });

  it('test database is migrated and writable', async () => {
    await resetDb();
    await createUser({ email: 'db-check@cpms.test' });
    expect(await prisma.user.count()).toBe(1);
  });
});
