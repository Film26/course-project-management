// F-01 API/DB integration tests — TEST-01-04 … TEST-01-12 (docs/sprints/sprint-1/F-01-auth.md §7)
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';

let student;
let instructorA;
let instructorB;
let course;

beforeEach(async () => {
  await resetDb();
  student = await createUser({ email: 'student1@cpms.test', role: 'STUDENT', displayName: 'Student One' });
  instructorA = await createUser({ email: 'inst-a@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor A' });
  instructorB = await createUser({ email: 'inst-b@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor B' });
  course = await prisma.course.create({
    data: {
      code: 'CPE334',
      name: 'Software Engineering',
      instructorId: instructorA.id,
      proposalDeadline: new Date('2026-12-31T16:59:59Z'),
      teams: { create: { name: 'Team Alpha', members: { create: { userId: student.id } } } },
    },
  });
});

afterAll(() => prisma.$disconnect());

/** Log in and return the cookie header to reuse on later requests. */
async function login(email, password = PASSWORD) {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

describe('POST /api/auth/login', () => {
  it('TEST-01-04 valid credentials → 200, user only, HttpOnly cookie, hashed session token (AC-01-01, AC-01-09)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '  Student1@CPMS.test ', password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: student.id, email: 'student1@cpms.test', displayName: 'Student One', role: 'STUDENT' },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|tokenHash/);

    const cookie = res.headers['set-cookie']?.find((c) => c.startsWith('sid='));
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const token = cookie.split(';')[0].slice('sid='.length);
    const sessions = await prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].userId).toBe(student.id);
    expect(sessions[0].tokenHash).not.toBe(token);
  });

  it('TEST-01-05 wrong password and unknown email → identical 401, no cookie, no session (AC-01-02)', async () => {
    const wrongPw = await request(app).post('/api/auth/login').send({ email: 'student1@cpms.test', password: 'nope' });
    const noUser = await request(app).post('/api/auth/login').send({ email: 'ghost@cpms.test', password: 'nope' });

    for (const res of [wrongPw, noUser]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
    expect(wrongPw.body).toEqual(noUser.body);
    expect(await prisma.session.count()).toBe(0);
  });

  it('TEST-01-06 missing / empty fields → 400 VALIDATION_ERROR naming the fields (AC-01-03)', async () => {
    const empty = await request(app).post('/api/auth/login').send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(empty.body.error.details)).toEqual(expect.arrayContaining(['email', 'password']));

    const blankPw = await request(app).post('/api/auth/login').send({ email: 'a@b.c', password: '' });
    expect(blankPw.status).toBe(400);
    expect(Object.keys(blankPw.body.error.details)).toEqual(['password']);
  });
});

describe('GET /api/auth/me', () => {
  it('TEST-01-07 identity comes from the session, client-supplied id/role are ignored (AC-01-04)', async () => {
    const cookie = await login('student1@cpms.test');
    const res = await request(app)
      .get(`/api/auth/me?userId=${instructorA.id}`)
      .set('Cookie', cookie)
      .set('X-User-Role', 'INSTRUCTOR');

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: student.id,
      email: 'student1@cpms.test',
      displayName: 'Student One',
      role: 'STUDENT',
    });
  });

  it('TEST-01-08 no cookie or an unknown token → 401 without private data (AC-01-05)', async () => {
    const paths = ['/api/auth/me', `/api/courses/${course.id}/roster`];
    for (const path of paths) {
      for (const cookie of [undefined, 'sid=forged-token-value']) {
        const req = request(app).get(path);
        if (cookie) req.set('Cookie', cookie);
        const res = await req;
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
        expect(res.body.user).toBeUndefined();
        expect(res.body.teams).toBeUndefined();
      }
    }
  });

  it('TEST-01-09 an expired session → 401 (AC-01-05, NFR-04)', async () => {
    const cookie = await login('student1@cpms.test');
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('POST /api/auth/logout', () => {
  it('TEST-01-10 logout revokes the session; the old cookie no longer works (AC-01-06)', async () => {
    const cookie = await login('student1@cpms.test');

    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);

    const after = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(after.status).toBe(401);

    const [session] = await prisma.session.findMany();
    expect(session.revokedAt).not.toBeNull();
  });
});

describe('GET /api/courses — list scoped to the current user', () => {
  it('TEST-01-14 instructor sees courses they teach; student sees courses of their team; other instructor sees none (AC-01-11)', async () => {
    const expected = [{ id: course.id, code: 'CPE334', name: 'Software Engineering' }];

    const a = await request(app).get('/api/courses').set('Cookie', await login('inst-a@cpms.test'));
    expect(a.status).toBe(200);
    expect(a.body.courses).toEqual(expected);

    const s = await request(app).get('/api/courses').set('Cookie', await login('student1@cpms.test'));
    expect(s.body.courses).toEqual(expected);

    const b = await request(app).get('/api/courses').set('Cookie', await login('inst-b@cpms.test'));
    expect(b.body.courses).toEqual([]);

    const anon = await request(app).get('/api/courses');
    expect(anon.status).toBe(401);
  });
});

describe('GET /api/courses/:courseId/roster — role and ownership', () => {
  it('TEST-01-11 a STUDENT is forbidden (AC-01-07)', async () => {
    const cookie = await login('student1@cpms.test');
    const res = await request(app).get(`/api/courses/${course.id}/roster`).set('Cookie', cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.teams).toBeUndefined();
  });

  it('TEST-01-12 owning instructor 200; other instructor 403; unknown course 404 (AC-01-08)', async () => {
    const cookieA = await login('inst-a@cpms.test');
    const ok = await request(app).get(`/api/courses/${course.id}/roster`).set('Cookie', cookieA);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual({
      course: { id: course.id, code: 'CPE334', name: 'Software Engineering' },
      teams: [
        {
          id: expect.any(Number),
          name: 'Team Alpha',
          members: [{ id: student.id, displayName: 'Student One', email: 'student1@cpms.test' }],
        },
      ],
    });

    const cookieB = await login('inst-b@cpms.test');
    const other = await request(app).get(`/api/courses/${course.id}/roster`).set('Cookie', cookieB);
    expect(other.status).toBe(403);
    expect(other.body.teams).toBeUndefined();

    const missing = await request(app).get('/api/courses/999999/roster').set('Cookie', cookieA);
    expect(missing.status).toBe(404);
  });
});
