// F-04 API/DB integration tests — TEST-04-03 … TEST-04-11 (docs/sprints/sprint-2/F-04-milestones.md §7)
// Every negative test also checks the database, so a rejected request is proven to leave no partial data (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';
import { seedMilestones } from '../prisma/seedMilestones.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let student1, student3, outsider, instructor1, instructor2;
let course, otherCourse, alpha, m1, m2, m3;

const body = (data = {}) => ({
  title: 'M4 Demo',
  description: 'Final demonstration',
  dueAt: '2026-12-13T23:59:00+07:00',
  weight: 10,
  maxScore: 100,
  ...data,
});

beforeEach(async () => {
  await resetDb();
  student1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  student3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  // Not in any team of CPE334, so not part of the course (F-03 Enrollment replaces this check later).
  outsider = await createUser({ email: 'student7@cpms.test', displayName: 'Outsider' });
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  otherCourse = await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  alpha = await prisma.team.create({
    data: { name: 'Team Alpha', courseId: course.id, members: { create: [{ userId: student1.id, courseId: course.id }] } },
  });
  await prisma.team.create({
    data: { name: 'Team Beta', courseId: course.id, members: { create: [{ userId: student3.id, courseId: course.id }] } },
  });
  // F-03: students of CPE334 are enrolled; the outsider is not (F-04 M5 uses Enrollment once F-03 is merged).
  await prisma.enrollment.createMany({ data: [student1, student3].map((s) => ({ courseId: course.id, userId: s.id })) });

  // Same three milestones as the seed: total weight 90 %. Created out of order to prove the sort.
  m3 = await makeMilestone({ title: 'M3 Final release', dueAt: new Date('2026-12-13T16:59:00Z'), weight: 40 });
  m1 = await makeMilestone({ title: 'M1 Requirements', dueAt: new Date('2026-12-01T16:59:00Z'), weight: 20 });
  m2 = await makeMilestone({ title: 'M2 Design', dueAt: new Date('2026-12-06T16:59:00Z'), weight: 30 });
});

afterAll(() => prisma.$disconnect());

function makeMilestone(data, courseId = course.id) {
  return prisma.milestone.create({ data: { courseId, description: '', maxScore: 100, ...data } });
}

/** Log in through the real F-01 endpoint and return the session cookie. */
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

async function totalWeight(courseId = course.id) {
  const r = await prisma.milestone.aggregate({ where: { courseId }, _sum: { weight: true } });
  return r._sum.weight ?? 0;
}

const snapshot = () => prisma.milestone.findMany({ orderBy: { id: 'asc' } });

describe('create milestone — POST /api/courses/:courseId/milestones', () => {
  it('TEST-04-03 the course instructor creates a milestone; dueAt is stored in UTC and courseId in the body is ignored (AC-04-01)', async () => {
    const c = await as(instructor1);
    const res = await request(app)
      .post(`/api/courses/${course.id}/milestones`)
      .set('Cookie', c)
      .send(body({ title: '  M4 Demo ', courseId: otherCourse.id }));

    expect(res.status).toBe(201);
    expect(res.body.milestone).toMatchObject({
      courseId: course.id,
      title: 'M4 Demo',
      description: 'Final demonstration',
      dueAt: '2026-12-13T16:59:00.000Z',
      weight: 10,
      maxScore: 100,
    });
    const row = await prisma.milestone.findUnique({ where: { id: res.body.milestone.id } });
    expect(row).toMatchObject({ courseId: course.id, title: 'M4 Demo', weight: 10, maxScore: 100 });
    expect(row.dueAt.toISOString()).toBe('2026-12-13T16:59:00.000Z');
    expect(await prisma.milestone.count({ where: { courseId: otherCourse.id } })).toBe(0);
  });

  it('TEST-04-04 invalid input → 400 VALIDATION_ERROR naming the field; nothing stored or changed (AC-04-02)', async () => {
    const c = await as(instructor1);
    const before = await snapshot();

    const empty = await request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    expect(empty.body.error.details).toHaveProperty('title');
    expect(empty.body.error.details).toHaveProperty('dueAt');

    const heavy = await request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ weight: 101 }));
    expect(heavy.status).toBe(400);
    expect(heavy.body.error.details).toHaveProperty('weight');

    const blankTitle = await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ title: '' });
    expect(blankTitle.status).toBe(400);
    expect(blankTitle.body.error.details).toHaveProperty('title');

    expect(await snapshot()).toEqual(before);
  });
});

describe('weight total — BR-09', () => {
  it('TEST-04-05 a total above 100 % is rejected with the current total; exactly 100 % is accepted (AC-04-03)', async () => {
    const c = await as(instructor1);

    const over = await request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ weight: 11 }));
    expect(over.status).toBe(409);
    expect(over.body.error.code).toBe('WEIGHT_EXCEEDED');
    expect(over.body.error.details).toMatchObject({ currentTotal: 90, requested: 11, max: 100 });
    expect(over.body.milestone).toBeUndefined();
    expect(await totalWeight()).toBe(90);

    const exact = await request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ weight: 10 }));
    expect(exact.status).toBe(201);
    expect(await totalWeight()).toBe(100);

    const edit = await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ weight: 21 });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('WEIGHT_EXCEEDED');
    expect((await prisma.milestone.findUnique({ where: { id: m1.id } })).weight).toBe(20);
    expect(await totalWeight()).toBe(100);
  });

  it('TEST-04-06 two concurrent creates that together exceed 100 % store exactly one (AC-04-03, NFR-06)', async () => {
    await prisma.milestone.deleteMany({ where: { courseId: course.id } });
    await makeMilestone({ title: 'Half', dueAt: new Date('2026-12-01T00:00:00Z'), weight: 50 });
    const c = await as(instructor1);

    const results = await Promise.all([
      request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ title: 'A', weight: 30 })),
      request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ title: 'B', weight: 30 })),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await totalWeight()).toBe(80);
    expect(await prisma.milestone.count({ where: { courseId: course.id } })).toBe(2);
  });
});

describe('edit and delete — PATCH | DELETE /api/milestones/:id', () => {
  it('TEST-04-07 editing changes only the sent fields; a milestone\'s own old weight is not counted twice (AC-04-04)', async () => {
    const c = await as(instructor1);

    const weight = await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ weight: 30 });
    expect(weight.status).toBe(200);
    expect(weight.body.milestone).toMatchObject({ id: m1.id, weight: 30, title: 'M1 Requirements' });
    expect(await totalWeight()).toBe(100);

    const title = await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ title: 'M1 SRS', courseId: otherCourse.id });
    expect(title.status).toBe(200);
    const row = await prisma.milestone.findUnique({ where: { id: m1.id } });
    expect(row).toMatchObject({ title: 'M1 SRS', weight: 30, maxScore: 100, courseId: course.id });
    expect(row.dueAt.toISOString()).toBe(m1.dueAt.toISOString());
  });

  it('TEST-04-08 deleting a milestone removes it and frees its weight (AC-04-05)', async () => {
    const c = await as(instructor1);

    const del = await request(app).delete(`/api/milestones/${m3.id}`).set('Cookie', c);
    expect(del.status).toBe(204);
    expect(await prisma.milestone.findUnique({ where: { id: m3.id } })).toBeNull();
    expect(await totalWeight()).toBe(50);

    const reuse = await request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', c).send(body({ weight: 50 }));
    expect(reuse.status).toBe(201);
    expect(await totalWeight()).toBe(100);
  });
});

describe('list milestones — GET /api/courses/:courseId/milestones (FR-13, FR-14)', () => {
  it('TEST-04-09 the instructor sees milestones sorted by due date with the total; a team member sees the team status; unknown ids → 404 (AC-04-06)', async () => {
    const ci = await as(instructor1);
    const list = await request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', ci);
    expect(list.status).toBe(200);
    expect(list.body.course).toMatchObject({ id: course.id, code: 'CPE334' });
    expect(list.body.totalWeight).toBe(90);
    expect(list.body.milestones.map((m) => m.title)).toEqual(['M1 Requirements', 'M2 Design', 'M3 Final release']);
    expect(list.body.milestones[0]).not.toHaveProperty('teamStatus');

    const cs = await as(student1);
    const mine = await request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', cs);
    expect(mine.status).toBe(200);
    expect(mine.body.team).toEqual({ id: alpha.id, name: 'Team Alpha' });
    expect(mine.body.totalWeight).toBe(90);
    expect(mine.body.milestones.map((m) => [m.id, m.teamStatus])).toEqual([
      [m1.id, 'NOT_SUBMITTED'],
      [m2.id, 'NOT_SUBMITTED'],
      [m3.id, 'NOT_SUBMITTED'],
    ]);

    expect((await request(app).get('/api/courses/999999/milestones').set('Cookie', ci)).status).toBe(404);
    expect((await request(app).patch('/api/milestones/999999').set('Cookie', ci).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete('/api/milestones/999999').set('Cookie', ci)).status).toBe(404);
    expect((await request(app).get('/api/courses/abc/milestones').set('Cookie', ci)).status).toBe(400);
  });

  // Was it.todo until F-03 added Enrollment (contract v1.1); runs from contract v1.3 on.
  it('TEST-04-09b an enrolled student without a team sees teamStatus NO_TEAM (AC-04-06)', async () => {
    const student5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' });
    await prisma.enrollment.create({ data: { courseId: course.id, userId: student5.id } });
    const res = await request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', await as(student5));
    expect(res.status).toBe(200);
    expect(res.body.team).toBeNull();
    expect(res.body.milestones.map((m) => m.teamStatus)).toEqual(['NO_TEAM', 'NO_TEAM', 'NO_TEAM']);
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-04-10 a student cannot write; an instructor of another course cannot read or write; a student outside the course cannot read (AC-04-07)', async () => {
    const before = await snapshot();
    const cs = await as(student1);
    const ci2 = await as(instructor2);
    const co = await as(outsider);

    const attempts = [
      request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', cs).send(body()),
      request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', cs).send({ title: 'hack' }),
      request(app).delete(`/api/milestones/${m1.id}`).set('Cookie', cs),
      request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', ci2),
      request(app).post(`/api/courses/${course.id}/milestones`).set('Cookie', ci2).send(body()),
      request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', ci2).send({ title: 'hack' }),
      request(app).delete(`/api/milestones/${m1.id}`).set('Cookie', ci2),
      request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', co),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.milestone).toBeUndefined();
      expect(res.body.milestones).toBeUndefined();
    }
    expect(await snapshot()).toEqual(before);
  });

  it('TEST-04-11 every F-04 endpoint rejects requests without a session (AC-04-08)', async () => {
    const before = await snapshot();
    const attempts = [
      request(app).get(`/api/courses/${course.id}/milestones`),
      request(app).post(`/api/courses/${course.id}/milestones`).send(body()),
      request(app).patch(`/api/milestones/${m1.id}`).send({ title: 'x' }),
      request(app).delete(`/api/milestones/${m1.id}`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.milestones).toBeUndefined();
    }
    expect(await snapshot()).toEqual(before);
  });
});

describe('contract v1.2 — PR #48 review', () => {
  it('TEST-04-13 the seed adds milestones only to a course that has none, so a re-run never breaks BR-09 (AC-04-03)', async () => {
    // A course without milestones gets the three seed milestones (90 %).
    await prisma.milestone.deleteMany({ where: { courseId: course.id } });
    expect(await seedMilestones(prisma, course.id)).toBe(3);
    expect(await totalWeight()).toBe(90);

    // The instructor renames M1 and adds a 10 % milestone (total 100 %). The next deploy runs the seed again.
    const first = await prisma.milestone.findFirst({ where: { courseId: course.id, title: 'M1 Requirements' } });
    await prisma.milestone.update({ where: { id: first.id }, data: { title: 'M1 SRS' } });
    await makeMilestone({ title: 'M4 Demo', dueAt: new Date('2026-12-12T11:00:00Z'), weight: 10 });
    expect(await seedMilestones(prisma, course.id)).toBe(0);
    expect(await totalWeight()).toBe(100);
    expect(await prisma.milestone.count({ where: { courseId: course.id } })).toBe(4);

    // Same when the instructor deleted a seed milestone.
    await prisma.milestone.deleteMany({ where: { courseId: course.id, title: 'M2 Design' } });
    expect(await seedMilestones(prisma, course.id)).toBe(0);
    expect(await totalWeight()).toBe(70);
  });

  it('TEST-04-14 two deletes of the same milestone at the same time give 204 and 404, never 500 (AC-04-05, NFR-05)', async () => {
    const c = await as(instructor1);
    const results = await Promise.all([
      request(app).delete(`/api/milestones/${m1.id}`).set('Cookie', c),
      request(app).delete(`/api/milestones/${m1.id}`).set('Cookie', c),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([204, 404]);
    expect(await prisma.milestone.findUnique({ where: { id: m1.id } })).toBeNull();
  });

  it('TEST-04-14b an edit that meets a concurrent delete gives 404, never 500 (AC-04-04, NFR-05)', async () => {
    const c = await as(instructor1);
    const [edit, del] = await Promise.all([
      request(app).patch(`/api/milestones/${m2.id}`).set('Cookie', c).send({ title: 'M2 SDS' }),
      request(app).delete(`/api/milestones/${m2.id}`).set('Cookie', c),
    ]);
    expect(del.status).toBe(204);
    expect([200, 404]).toContain(edit.status);
    expect(await prisma.milestone.findUnique({ where: { id: m2.id } })).toBeNull();
  });
});
