// F-08 API/DB integration tests — TEST-08-03 … TEST-08-05 (docs/sprints/sprint-3/F-08-dashboard.md §7, contract v1.1)
// All fixtures are created here (no seed). The dashboard is read-only, so each test also checks nothing changed (D1).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let s1, s2, s3, instructor1, instructor2;
let course, alpha, beta, m1, m2;

beforeEach(async () => {
  await resetDb();
  s1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  s2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  s3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });
  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.course.create({ data: { code: 'CPE999', name: 'Other', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) } });
  await prisma.enrollment.createMany({ data: [s1, s2, s3].map((s) => ({ courseId: course.id, userId: s.id })) });
  alpha = await makeTeam('Team Alpha', [s1, s2]);
  beta = await makeTeam('Team Beta', [s3]);
  m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() - 2 * DAY), weight: 20, maxScore: 100 } });
  m2 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M2 Design', dueAt: new Date(Date.now() - DAY), weight: 30, maxScore: 100 } });
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
  prisma.submission.create({ data: { milestoneId: m.id, teamId: team.id, version: v, url: `https://example.com/${team.id}/v${v}`, isLate, submittedById: s1.id } });
const grade = (sub, score, releasedAt = null) =>
  prisma.grade.create({ data: { submissionId: sub.id, score, feedback: 'Feedback', gradedById: instructor1.id, gradedAt: new Date(), releasedAt } });
const dashboard = (c, id = course.id) => request(app).get(`/api/courses/${id}/dashboard`).set('Cookie', c);

/** TEST-08-03 data: Alpha APPROVED, M1 v1+v2 on time with 85 released on v2; M2 late v1 graded 70 (not released). Beta: nothing. */
async function alphaData() {
  await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Old idea', description: 'd', status: 'REJECTED', rejectReason: 'Too broad', decidedAt: new Date(Date.now() - 5 * DAY) } });
  const approved = await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'd', status: 'APPROVED', decidedAt: new Date() } });
  await version(m1, alpha, 1);
  await grade(await version(m1, alpha, 2), 85, new Date());
  await grade(await version(m2, alpha, 1, true), 70);
  return approved;
}

describe('dashboard — GET /api/courses/:courseId/dashboard (FR-21)', () => {
  it('TEST-08-03 rows, cells and totals match the stored records (AC-08-01 … AC-08-04)', async () => {
    const approved = await alphaData();
    const before = await prisma.$queryRaw`SELECT (SELECT count(*) FROM "Submission")::int AS s, (SELECT count(*) FROM "Grade" WHERE "releasedAt" IS NOT NULL)::int AS g`;

    const res = await dashboard(await as(instructor1));
    expect(res.status).toBe(200);
    expect(res.body.course).toEqual({ id: course.id, code: 'CPE334', name: 'Software Engineering' });
    expect(res.body.milestones.map((m) => m.title)).toEqual(['M1 Requirements', 'M2 Design']);
    expect(res.body.milestones[0]).toMatchObject({ id: m1.id, weight: 20, maxScore: 100 });

    const [a, b] = res.body.teams;
    expect(a).toEqual({
      id: alpha.id,
      name: 'Team Alpha',
      memberCount: 2,
      proposal: { id: approved.id, title: 'Smart Parking', status: 'APPROVED' },
      cells: [
        { milestoneId: m1.id, status: 'SUBMITTED', versionCount: 2, grade: { state: 'RELEASED', score: 85 } },
        { milestoneId: m2.id, status: 'LATE', versionCount: 1, grade: { state: 'GRADED', score: 70 } },
      ],
      lateCount: 1,
      releasedCount: 1,
      releasedWeightedScore: 17, // 85 / 100 × 20; the unreleased 70 on M2 is not counted (BR-12)
    });
    expect(b).toEqual({
      id: beta.id,
      name: 'Team Beta',
      memberCount: 1,
      proposal: null,
      cells: [
        { milestoneId: m1.id, status: 'NOT_SUBMITTED', versionCount: 0, grade: { state: 'NONE', score: null } },
        { milestoneId: m2.id, status: 'NOT_SUBMITTED', versionCount: 0, grade: { state: 'NONE', score: null } },
      ],
      lateCount: 0,
      releasedCount: 0,
      releasedWeightedScore: 0,
    });
    expect(res.body.totals).toEqual({
      teams: 2,
      proposals: { DRAFT: 0, SUBMITTED: 0, APPROVED: 1, REJECTED: 0, NONE: 1 },
      perMilestone: [
        { milestoneId: m1.id, submitted: 1, late: 0 },
        { milestoneId: m2.id, submitted: 1, late: 1 },
      ],
    });
    // D1: read-only.
    const after = await prisma.$queryRaw`SELECT (SELECT count(*) FROM "Submission")::int AS s, (SELECT count(*) FROM "Grade" WHERE "releasedAt" IS NOT NULL)::int AS g`;
    expect(after).toEqual(before);
  });

  it('a team whose only proposals are rejected shows the newest rejected one; an empty course shows no teams', async () => {
    await prisma.proposal.create({ data: { teamId: beta.id, title: 'First', description: 'd', status: 'REJECTED', decidedAt: new Date(Date.now() - 3 * DAY) } });
    await prisma.proposal.create({ data: { teamId: beta.id, title: 'Second', description: 'd', status: 'REJECTED', decidedAt: new Date(Date.now() - DAY) } });
    const res = await dashboard(await as(instructor1));
    expect(res.body.teams.find((t) => t.id === beta.id).proposal).toMatchObject({ title: 'Second', status: 'REJECTED' });
    expect(res.body.totals.proposals).toMatchObject({ REJECTED: 1, NONE: 1 });

    const empty = await prisma.course.create({ data: { code: 'CPE335', name: 'Empty', instructorId: instructor1.id, proposalDeadline: new Date() } });
    const none = await dashboard(await as(instructor1), empty.id);
    expect(none.status).toBe(200);
    expect(none.body).toMatchObject({ milestones: [], teams: [], totals: { teams: 0, perMilestone: [] } });
  });

  it('TEST-08-04 the response uses a fixed number of queries, for 2 teams and for 20 teams (D4, NFR-10)', async () => {
    await alphaData();
    const c = await as(instructor1);
    const queries = [];
    const listener = (e) => queries.push(e.query);
    prisma.$on('query', listener);
    const countFor = async (path) => {
      queries.length = 0;
      const res = await request(app).get(path).set('Cookie', c);
      expect(res.status).toBe(200);
      return queries.length;
    };
    // The session lookup is the same for every protected endpoint; /api/auth/me does only that.
    const auth = await countFor('/api/auth/me');
    const count = async () => (await countFor(`/api/courses/${course.id}/dashboard`)) - auth;
    const small = await count();
    console.log(`TEST-08-04 dashboard queries: ${small} (2 teams)`);

    for (let i = 3; i <= 20; i++) {
      const u = await createUser({ email: `extra${i}@cpms.test` });
      await prisma.enrollment.create({ data: { courseId: course.id, userId: u.id } });
      const t = await makeTeam(`Team ${String(i).padStart(2, '0')}`, [u]);
      await prisma.proposal.create({ data: { teamId: t.id, title: `P${i}`, description: 'd', status: 'SUBMITTED' } });
      await grade(await version(m1, t, 1), 50 + i);
    }
    const large = await count();
    console.log(`TEST-08-04 dashboard queries: ${large} (20 teams)`);
    expect((await dashboard(c)).body.teams).toHaveLength(20);
    expect(auth).toBeGreaterThan(0); // the listener really sees queries
    expect(small).toBeGreaterThanOrEqual(5);
    expect(small).toBeLessThanOrEqual(6);
    expect(large).toBe(small);
    prisma.$off?.('query', listener);
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-08-05 student and other instructor → 403 without data; no session 401; unknown 404; abc 400 (AC-08-05)', async () => {
    await alphaData();
    for (const user of [s1, instructor2]) {
      const res = await dashboard(await as(user));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body).not.toHaveProperty('teams');
    }
    const anon = await request(app).get(`/api/courses/${course.id}/dashboard`);
    expect(anon.status).toBe(401);
    const c = await as(instructor1);
    expect((await request(app).get('/api/courses/999999/dashboard').set('Cookie', c)).status).toBe(404);
    const bad = await request(app).get('/api/courses/abc/dashboard').set('Cookie', c);
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toHaveProperty('courseId');
  });
});
