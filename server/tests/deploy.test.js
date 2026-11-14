// Lab 5 (R-01, R-03, R-08): endpoints and behaviour the container and the Cloud Run pipeline rely on.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { prisma } from './helpers/db.js';

afterAll(() => prisma.$disconnect());

describe('readiness and version (smoke test endpoints)', () => {
  it('GET /api/ready reports the database as connected', async () => {
    const res = await request(createApp()).get('/api/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ready', db: 'connected' });
  });

  it('GET /api/version returns the commit the build came from', async () => {
    const saved = config.appCommit;
    config.appCommit = '0123456789abcdef0123456789abcdef01234567';
    try {
      const res = await request(createApp()).get('/api/version');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ commit: '0123456789abcdef0123456789abcdef01234567' });
    } finally {
      config.appCommit = saved;
    }
  });
});

describe('serving the built UI from the same origin (container mode)', () => {
  const saved = config.clientDistDir;
  afterEach(() => {
    config.clientDistDir = saved;
  });

  function distWithIndex() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpms-dist-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>CPMS</title><div id="root"></div>');
    return dir;
  }

  it('serves index.html at / and for any non-API path (single-page app)', async () => {
    config.clientDistDir = distWithIndex();
    const app = createApp();
    for (const p of ['/', '/some/view']) {
      const res = await request(app).get(p);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>CPMS</title>');
    }
  });

  it('unknown /api routes still return the JSON 404, never the UI', async () => {
    config.clientDistDir = distWithIndex();
    const res = await request(createApp()).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('without CLIENT_DIST_DIR (local dev) the API does not serve the UI', async () => {
    config.clientDistDir = null;
    const res = await request(createApp()).get('/');
    expect(res.status).toBe(404);
  });
});
