// F-07 API/DB integration tests — TEST-07-03 … TEST-07-09 (docs/sprints/sprint-3/F-07-peer-eval.md §7, contract v1.0)
// All fixtures are created here (no seed). Every rejected request also checks the database (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let s1, s2, s3, s4, s5, s6, instructor1, instructor2;
let course, alpha, beta, m1, m2, otherMilestone;

beforeEach(async () => {
  await resetDb();
  s1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  s2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  s3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  s4 = await createUser({ email: 'student4@cpms.test', displayName: 'Student Four' });
  s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' }); // enrolled, no team
  s6 = await createUser({ email: 'student6@cpms.test', displayName: 'Student Six' }); // not enrolled in CPE334
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  const other = await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.enrollment.createMany({ data: [s1, s2, s3, s4, s5].map((s) => ({ courseId: course.id, userId: s.id })) });
  await prisma.enrollment.create({ data: { courseId: other.id, userId: s6.id } });
  alpha = await makeTeam(course, 'Team Alpha', [s1, s2]);
  beta = await makeTeam(course, 'Team Beta', [s3, s4]);
  m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() + 7 * DAY), weight: 20, maxScore: 100 } });
  m2 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M2 Design', dueAt: new Date(Date.now() + 14 * DAY), weight: 30, maxScore: 100 } });
  otherMilestone = await prisma.milestone.create({ data: { courseId: other.id, title: 'X1', dueAt: new Date(Date.now() + 7 * DAY), weight: 10, maxScore: 10 } });
});

afterAll(() => prisma.$disconnect());

function makeTeam(c, name, members) {
  return prisma.team.create({ data: { name, courseId: c.id, members: { create: members.map((u) => ({ userId: u.id, courseId: c.id })) } } });
}
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
const rate = (c, m, body) => request(app).post(`/api/milestones/${m.id}/peer-ratings`).set('Cookie', c).send(body);
const mine = (c, m) => request(app).get(`/api/milestones/${m.id}/peer-ratings/mine`).set('Cookie', c);
const summary = (c, query = '') => request(app).get(`/api/courses/${course.id}/peer-ratings${query}`).set('Cookie', c);
const store = (m, rater, ratee, score, comment = '') =>
  prisma.peerRating.create({ data: { milestoneId: m.id, teamId: alpha.id, raterId: rater.id, rateeId: ratee.id, score, comment } });

describe('rate — POST /api/milestones/:id/peer-ratings (FR-19, BR-13)', () => {
  it('TEST-07-03 a member rates a teammate; the rater comes from the session (AC-07-01)', async () => {
    const res = await rate(await as(s1), m1, { rateeId: s2.id, score: 4, comment: ' Did the API tests ', raterId: s2.id });
    expect(res.status).toBe(201);
    expect(res.body.rating).toMatchObject({ milestoneId: m1.id, ratee: { id: s2.id, displayName: 'Student Two' }, score: 4, comment: 'Did the API tests' });
    expect(res.body.rating).not.toHaveProperty('rater');
    const rows = await prisma.peerRating.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ milestoneId: m1.id, teamId: alpha.id, raterId: s1.id, rateeId: s2.id, score: 4 });
  });

  it('TEST-07-04 invalid input → 400 naming the field, nothing stored; scores 1 and 5 are accepted (AC-07-02)', async () => {
    const c = await as(s1);
    for (const [body, field] of [
      [{ score: 4 }, 'rateeId'],
      [{ rateeId: 'abc', score: 4 }, 'rateeId'],
      [{ rateeId: s2.id, score: 0 }, 'score'],
      [{ rateeId: s2.id, score: 6 }, 'score'],
      [{ rateeId: s2.id, score: 3.5 }, 'score'],
      [{ rateeId: s2.id, score: 4, comment: 'x'.repeat(501) }, 'comment'],
    ]) {
      const res = await rate(c, m1, body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty(field);
    }
    expect(await prisma.peerRating.count()).toBe(0);
    expect((await rate(c, m1, { rateeId: s2.id, score: 1 })).status).toBe(201);
    expect((await rate(c, m2, { rateeId: s2.id, score: 5 })).status).toBe(201);
    expect(await prisma.peerRating.count()).toBe(2);
  });

  it('TEST-07-05 self, another team, unknown user and a former member are refused (AC-07-03, AC-07-04)', async () => {
    const c = await as(s1);
    const self = await rate(c, m1, { rateeId: s1.id, score: 5 });
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe('SELF_RATING');

    for (const rateeId of [s3.id, 999999]) {
      const res = await rate(c, m1, { rateeId, score: 3 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_A_TEAMMATE');
    }
    // s2 leaves Team Alpha: no longer a current teammate.
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId: alpha.id, userId: s2.id } } });
    const former = await rate(c, m1, { rateeId: s2.id, score: 3 });
    expect(former.status).toBe(409);
    expect(former.body.error.code).toBe('NOT_A_TEAMMATE');
    expect(await prisma.peerRating.count()).toBe(0);

    // E1 also holds in the database.
    await expect(store(m1, s1, s1, 5)).rejects.toThrow();
  });

  it('TEST-07-06 once per teammate and milestone; another milestone is fine; a race stores one (AC-07-05)', async () => {
    const c1 = await as(s1);
    expect((await rate(c1, m1, { rateeId: s2.id, score: 4, comment: 'First' })).status).toBe(201);
    const again = await rate(c1, m1, { rateeId: s2.id, score: 1, comment: 'Second' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_RATED');
    expect(await prisma.peerRating.findFirst({ where: { milestoneId: m1.id, raterId: s1.id } })).toMatchObject({ score: 4, comment: 'First' });
    expect((await rate(c1, m2, { rateeId: s2.id, score: 2 })).status).toBe(201);

    const c2 = await as(s2);
    const results = await Promise.all([rate(c2, m1, { rateeId: s1.id, score: 3 }), rate(c2, m1, { rateeId: s1.id, score: 5 })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(results.find((r) => r.status === 409).body.error.code).toBe('ALREADY_RATED');
    expect(await prisma.peerRating.count({ where: { milestoneId: m1.id, raterId: s2.id } })).toBe(1);
  });

  it('a student without a team gets 409 NO_TEAM; an unknown milestone 404', async () => {
    const none = await rate(await as(s5), m1, { rateeId: s1.id, score: 3 });
    expect(none.status).toBe(409);
    expect(none.body.error.code).toBe('NO_TEAM');
    const missing = await request(app).post('/api/milestones/999999/peer-ratings').set('Cookie', await as(s1)).send({ rateeId: s2.id, score: 3 });
    expect(missing.status).toBe(404);
    expect(await prisma.peerRating.count()).toBe(0);
  });
});

describe('my ratings — GET /api/milestones/:id/peer-ratings/mine (BR-13 privacy)', () => {
  it('TEST-07-07 lists teammates with only the ratings the student gave (AC-07-06)', async () => {
    await store(m1, s1, s2, 4, 'Reliable');
    await store(m1, s2, s1, 2, 'SECRET-COMMENT-FROM-S2');

    const res = await mine(await as(s1), m1);
    expect(res.status).toBe(200);
    expect(res.body.milestone).toMatchObject({ id: m1.id, title: 'M1 Requirements' });
    expect(res.body.teammates).toEqual([{ id: s2.id, displayName: 'Student Two', rated: true, myRating: { score: 4, comment: 'Reliable' } }]);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('SECRET-COMMENT-FROM-S2');
    expect(text).not.toMatch(/"score":2/);

    // s2 has not rated anyone for M2 yet.
    const m2view = await mine(await as(s2), m2);
    expect(m2view.body.teammates).toEqual([{ id: s1.id, displayName: 'Student One', rated: false, myRating: null }]);
  });

  it('no team → 409 NO_TEAM; another course\'s milestone → 403', async () => {
    const none = await mine(await as(s5), m1);
    expect(none.status).toBe(409);
    expect(none.body.error.code).toBe('NO_TEAM');
    const other = await mine(await as(s1), otherMilestone);
    expect(other.status).toBe(403);
    expect(other.body).not.toHaveProperty('teammates');
  });
});

describe('instructor summary — GET /api/courses/:courseId/peer-ratings (FR-20)', () => {
  it('TEST-07-08 per-student average and count, all milestones and per milestone (AC-07-07)', async () => {
    await store(m1, s1, s2, 4, 'Good tests');
    await store(m2, s1, s2, 5);
    await store(m1, s2, s1, 3, 'Late once');

    const all = await summary(await as(instructor1));
    expect(all.status).toBe(200);
    expect(all.body.course).toMatchObject({ id: course.id, code: 'CPE334' });
    const byId = Object.fromEntries(all.body.students.map((s) => [s.id, s]));
    expect(byId[s2.id]).toMatchObject({ team: { id: alpha.id, name: 'Team Alpha' }, average: 4.5, count: 2, comments: ['Good tests'] });
    expect(byId[s1.id]).toMatchObject({ average: 3, count: 1, comments: ['Late once'] });
    expect(byId[s5.id]).toMatchObject({ team: null, average: null, count: 0, comments: [] });
    // Sorted by team name, then student name; students without a team last.
    expect(all.body.students.map((s) => s.displayName)).toEqual(['Student One', 'Student Two', 'Student Four', 'Student Three', 'Student Five']);
    // No rater identity in the instructor view (E4).
    expect(JSON.stringify(all.body)).not.toMatch(/rater/i);

    const onlyM1 = await summary(await as(instructor1), `?milestoneId=${m1.id}`);
    expect(onlyM1.status).toBe(200);
    expect(onlyM1.body.students.find((s) => s.id === s2.id)).toMatchObject({ average: 4, count: 1 });
  });

  it('a bad milestone filter → 400; a milestone of another course → 404', async () => {
    const c = await as(instructor1);
    expect((await summary(c, '?milestoneId=abc')).status).toBe(400);
    expect((await summary(c, `?milestoneId=${otherMilestone.id}`)).status).toBe(404);
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-07-09 forbidden roles and outsiders get 403 without data; no session 401 (AC-07-08)', async () => {
    await store(m1, s1, s2, 4, 'Hidden');
    const inst = await rate(await as(instructor1), m1, { rateeId: s2.id, score: 4 });
    expect(inst.status).toBe(403);

    const student = await summary(await as(s1));
    expect(student.status).toBe(403);
    expect(student.body).not.toHaveProperty('students');

    const otherInstructor = await summary(await as(instructor2));
    expect(otherInstructor.status).toBe(403);
    expect(otherInstructor.body).not.toHaveProperty('students');

    const outsider = await rate(await as(s6), m1, { rateeId: s1.id, score: 4 });
    expect(outsider.status).toBe(403);
    expect(await prisma.peerRating.count()).toBe(1);

    for (const r of [
      request(app).post(`/api/milestones/${m1.id}/peer-ratings`).send({ rateeId: s2.id, score: 4 }),
      request(app).get(`/api/milestones/${m1.id}/peer-ratings/mine`),
      request(app).get(`/api/courses/${course.id}/peer-ratings`),
    ]) {
      const res = await r;
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });

  it('unknown course → 404 for its instructor-only summary', async () => {
    const res = await request(app).get('/api/courses/999999/peer-ratings').set('Cookie', await as(instructor1));
    expect(res.status).toBe(404);
  });
});
