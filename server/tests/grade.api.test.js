// F-06 API/DB integration tests — TEST-06-04 … TEST-06-11, TEST-06-07b, TEST-06-13 (F-06 contract v1.1 §7)
// All fixtures are created here (no seed). Every negative test also checks the database (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

let s1, s2, s3, s5, instructor1, instructor2;
let course, alpha, beta, m1, m2;

beforeEach(async () => {
  await resetDb();
  s1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  s2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  s3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' }); // enrolled, no team
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.enrollment.createMany({ data: [s1, s2, s3, s5].map((s) => ({ courseId: course.id, userId: s.id })) });
  alpha = await makeTeam('Team Alpha', [s1, s2]);
  beta = await makeTeam('Team Beta', [s3]);
  await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'd', status: 'APPROVED' } });
  m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() + 7 * DAY), weight: 20, maxScore: 100 } });
  m2 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M2 Design', dueAt: new Date(Date.now() + 14 * DAY), weight: 30, maxScore: 100 } });
});

afterAll(() => prisma.$disconnect());

function makeTeam(name, members) {
  return prisma.team.create({ data: { name, courseId: course.id, members: { create: members.map((u) => ({ userId: u.id, courseId: course.id })) } } });
}
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
const version = (m, team, v, isLate = false) =>
  prisma.submission.create({ data: { milestoneId: m.id, teamId: team.id, version: v, url: `https://example.com/v${v}`, isLate, submittedById: s1.id } });
const grade = (sub, score, releasedAt = null) =>
  prisma.grade.create({ data: { submissionId: sub.id, score, feedback: 'Feedback', gradedById: instructor1.id, gradedAt: new Date(), releasedAt } });
const put = (c, sub, body) => request(app).put(`/api/submissions/${sub.id}/grade`).set('Cookie', c).send(body);
const release = (c, sub) => request(app).post(`/api/submissions/${sub.id}/grade/release`).set('Cookie', c);
const setDue = (m, dueAt) => prisma.milestone.update({ where: { id: m.id }, data: { dueAt } });
const gradeOf = (sub) => prisma.grade.findUnique({ where: { submissionId: sub.id } });

describe('grade — PUT /api/submissions/:id/grade (FR-17)', () => {
  it('TEST-06-04 the course instructor grades the current version and can change it before release (AC-06-01)', async () => {
    const v1 = await version(m1, alpha, 1);
    const c = await as(instructor1);
    expect((await put(c, v1, { score: 80, feedback: 'Good start' })).status).toBe(200);
    const res = await put(c, v1, { score: 85, feedback: 'Clear requirements', gradedById: s1.id });
    expect(res.status).toBe(200);
    expect(res.body.grade).toMatchObject({ submissionId: v1.id, score: 85, maxScore: 100, feedback: 'Clear requirements', releasedAt: null, gradedBy: { id: instructor1.id } });
    expect(await prisma.grade.count()).toBe(1);
    expect(await gradeOf(v1)).toMatchObject({ score: 85, gradedById: instructor1.id, releasedAt: null });

    // The instructor's submissions view shows the grade of the current version.
    const view = await request(app).get(`/api/milestones/${m1.id}/submissions`).set('Cookie', c);
    expect(view.body.teams.find((t) => t.team.id === alpha.id).grade).toMatchObject({ score: 85, releasedAt: null });
    expect(view.body.teams.find((t) => t.team.id === beta.id).grade).toBeNull();
  });

  it('TEST-06-05 invalid scores and feedback → 400 naming the field; 0 and maxScore are accepted (AC-06-02)', async () => {
    const v1 = await version(m1, alpha, 1);
    const c = await as(instructor1);
    for (const [body, field] of [
      [{ score: -1, feedback: 'x' }, 'score'],
      [{ score: 101, feedback: 'x' }, 'score'],
      [{ score: 85.5, feedback: 'x' }, 'score'],
      [{ score: 85, feedback: '' }, 'feedback'],
    ]) {
      const res = await put(c, v1, body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.details).toHaveProperty(field);
    }
    expect(await prisma.grade.count()).toBe(0);
    expect((await put(c, v1, { score: 0, feedback: 'Missing' })).status).toBe(200);
    expect((await put(c, v1, { score: 100, feedback: 'Perfect' })).status).toBe(200);
    expect((await gradeOf(v1)).score).toBe(100);
  });

  it('TEST-06-06 a version that is not current cannot be graded (AC-06-03)', async () => {
    const v1 = await version(m1, alpha, 1);
    await version(m1, alpha, 2);
    const res = await put(await as(instructor1), v1, { score: 70, feedback: 'Old version' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_CURRENT_VERSION');
    expect(await prisma.grade.count()).toBe(0);
  });
});

describe('release — POST /api/submissions/:id/grade/release (FR-17, D-08)', () => {
  it('TEST-06-07 not graded, before due, released, released again, edit after release (AC-06-04)', async () => {
    const v1 = await version(m1, alpha, 1);
    const c = await as(instructor1);
    const none = await release(c, v1);
    expect(none.status).toBe(409);
    expect(none.body.error.code).toBe('NOT_GRADED');
    expect((await put(c, v1, { score: 85, feedback: 'Clear' })).status).toBe(200);

    const early = await release(c, v1);
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('BEFORE_DUE');
    expect((await gradeOf(v1)).releasedAt).toBeNull();

    await setDue(m1, new Date(Date.now() - MIN));
    const ok = await release(c, v1);
    expect(ok.status).toBe(200);
    expect(ok.body.grade.releasedAt).not.toBeNull();

    const twice = await release(c, v1);
    expect(twice.status).toBe(409);
    expect(twice.body.error.code).toBe('GRADE_RELEASED');
    const edit = await put(c, v1, { score: 90, feedback: 'Changed' });
    expect(edit.status).toBe(409);
    expect(edit.body.error.code).toBe('GRADE_RELEASED');
    expect(await gradeOf(v1)).toMatchObject({ score: 85, feedback: 'Clear' });
  });

  it('TEST-06-07b a grade of a version that is no longer current cannot be released (AC-06-04, G3b)', async () => {
    const v1 = await version(m1, alpha, 1);
    await grade(v1, 80);
    await version(m1, alpha, 2);
    await setDue(m1, new Date(Date.now() - MIN));
    const res = await release(await as(instructor1), v1);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_CURRENT_VERSION');
    expect((await gradeOf(v1)).releasedAt).toBeNull();
  });
});

describe('student view — GET /api/courses/:courseId/my-grades (FR-18, BR-12)', () => {
  it('TEST-06-08 members see released grades of their own team only (AC-06-05)', async () => {
    await grade(await version(m1, alpha, 1), 85, new Date());
    await grade(await version(m2, alpha, 1), 70);

    const mine = await request(app).get(`/api/courses/${course.id}/my-grades`).set('Cookie', await as(s1));
    expect(mine.status).toBe(200);
    expect(mine.body.team).toEqual({ id: alpha.id, name: 'Team Alpha' });
    expect(mine.body.grades).toHaveLength(1);
    expect(mine.body.grades[0]).toMatchObject({ milestone: { id: m1.id, title: 'M1 Requirements', maxScore: 100 }, version: 1, score: 85, feedback: 'Feedback' });
    expect(JSON.stringify(mine.body)).not.toContain('M2 Design');
    expect(JSON.stringify(mine.body)).not.toContain('70');

    const other = await request(app).get(`/api/courses/${course.id}/my-grades`).set('Cookie', await as(s3));
    expect(other.status).toBe(200);
    expect(other.body.grades).toEqual([]);
  });
});

describe('cross-feature rules (G6)', () => {
  it('TEST-06-09 after release the team cannot submit again; maxScore cannot drop below a score (AC-06-06)', async () => {
    await setDue(m1, new Date(Date.now() - MIN));
    // Only a late version, so BR-11 alone would still allow another late version.
    await grade(await version(m1, alpha, 1, true), 85, new Date());

    const again = await request(app).post(`/api/milestones/${m1.id}/submissions`).set('Cookie', await as(s1)).send({ url: 'https://example.com/v2' });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('GRADE_RELEASED');
    expect(await prisma.submission.count({ where: { milestoneId: m1.id } })).toBe(1);

    const c = await as(instructor1);
    const lower = await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ maxScore: 80 });
    expect(lower.status).toBe(409);
    expect(lower.body.error.code).toBe('SCORE_ABOVE_MAX');
    expect((await prisma.milestone.findUnique({ where: { id: m1.id } })).maxScore).toBe(100);
    expect((await request(app).patch(`/api/milestones/${m1.id}`).set('Cookie', c).send({ maxScore: 90 })).status).toBe(200);
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-06-10 students cannot grade or release; other instructors are refused; no team → 409 (AC-06-07)', async () => {
    const v1 = await version(m1, alpha, 1);
    const cs = await as(s1);
    const ci2 = await as(instructor2);
    for (const res of [
      await put(cs, v1, { score: 100, feedback: 'self' }),
      await release(cs, v1),
      await put(ci2, v1, { score: 10, feedback: 'x' }),
      await release(ci2, v1),
      await request(app).get(`/api/milestones/${m1.id}/submissions`).set('Cookie', ci2),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.grade).toBeUndefined();
      expect(res.body.teams).toBeUndefined();
    }
    expect(await prisma.grade.count()).toBe(0);
    const noTeam = await request(app).get(`/api/courses/${course.id}/my-grades`).set('Cookie', await as(s5));
    expect(noTeam.status).toBe(409);
    expect(noTeam.body.error.code).toBe('NO_TEAM');
  });

  it('TEST-06-11 every F-06 endpoint rejects requests without a session (AC-06-08)', async () => {
    const v1 = await version(m1, alpha, 1);
    for (const res of [
      await request(app).put(`/api/submissions/${v1.id}/grade`).send({ score: 1, feedback: 'x' }),
      await request(app).post(`/api/submissions/${v1.id}/grade/release`),
      await request(app).get(`/api/courses/${course.id}/my-grades`),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('concurrency (G8, AC-06-10)', () => {
  it('TEST-06-13a a submit of v2 racing a grade of v1 never leaves a releasable grade on an old version', async () => {
    const cs = await as(s2);
    const ci = await as(instructor1);
    for (let i = 0; i < 10; i += 1) {
      await prisma.grade.deleteMany();
      await prisma.submission.deleteMany();
      const v1 = await version(m1, alpha, 1);
      const [sub, gr] = await Promise.all([
        request(app).post(`/api/milestones/${m1.id}/submissions`).set('Cookie', cs).send({ url: 'https://example.com/v2' }),
        put(ci, v1, { score: 75, feedback: 'v1' }),
      ]);
      expect(sub.status, `run ${i}`).toBe(201);
      expect([200, 409], `run ${i}`).toContain(gr.status);
      if (gr.status === 409) expect(gr.body.error.code).toBe('NOT_CURRENT_VERSION');
      const rel = await release(ci, v1); // v2 now exists, so v1 is never current
      expect(rel.status, `run ${i}`).toBe(409);
      expect(['NOT_GRADED', 'NOT_CURRENT_VERSION']).toContain(rel.body.error.code);
    }
  });

  it('TEST-06-13b an edit racing a release never changes a released grade', async () => {
    const ci = await as(instructor1);
    for (let i = 0; i < 10; i += 1) {
      await prisma.grade.deleteMany();
      await prisma.submission.deleteMany();
      const v1 = await version(m1, alpha, 1);
      await grade(v1, 85);
      await setDue(m1, new Date(Date.now() - MIN));
      const [edit, rel] = await Promise.all([put(ci, v1, { score: 90, feedback: 'edited' }), release(ci, v1)]);
      expect(rel.status, `run ${i}`).toBe(200);
      const stored = await gradeOf(v1);
      expect(stored.releasedAt).not.toBeNull();
      if (edit.status === 200) expect(stored.score).toBe(90);
      else {
        expect(edit.status).toBe(409);
        expect(edit.body.error.code).toBe('GRADE_RELEASED');
        expect(stored.score).toBe(85);
      }
      expect(rel.body.grade.score).toBe(stored.score); // what was released is what is stored
      await setDue(m1, new Date(Date.now() + 7 * DAY));
    }
  });
});
