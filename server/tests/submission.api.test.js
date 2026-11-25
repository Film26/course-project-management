// F-05 API/DB integration tests — TEST-05-05 … TEST-05-14 (docs/sprints/sprint-2/F-05-submissions.md §7)
// Every negative test also checks the database, so a rejected request is proven to leave no partial data (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;
const MIN = 60 * 1000;

let s1, s2, s3, s5, outsider, instructor1, instructor2;
let course, alpha, beta, m1, m2;

beforeEach(async () => {
  await resetDb();
  s1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  s2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  s3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' }); // enrolled, no team
  outsider = await createUser({ email: 'student7@cpms.test', displayName: 'Not Enrolled' });
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
  // Team Alpha's proposal is approved (BR-10); Team Beta has none.
  await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'd', status: 'APPROVED' } });

  m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() + 7 * DAY), weight: 20, maxScore: 100 } });
  m2 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M2 Design', dueAt: new Date(Date.now() + 14 * DAY), weight: 30, maxScore: 100 } });
});

afterAll(() => prisma.$disconnect());

function makeTeam(name, members) {
  return prisma.team.create({ data: { name, courseId: course.id, members: { create: members.map((u) => ({ userId: u.id, courseId: course.id })) } } });
}
/** Log in through the real F-01 endpoint and return the session cookie. */
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
const submit = (c, m, body = { url: 'https://github.com/team-alpha/cpms', note: 'first version' }) =>
  request(app).post(`/api/milestones/${m.id}/submissions`).set('Cookie', c).send(body);
const view = (c, m) => request(app).get(`/api/milestones/${m.id}/submissions`).set('Cookie', c);
const rows = (where = {}) => prisma.submission.findMany({ where, orderBy: [{ milestoneId: 'asc' }, { version: 'asc' }] });
const addVersion = (m, team, version, isLate, by = s1) =>
  prisma.submission.create({ data: { milestoneId: m.id, teamId: team.id, version, url: `https://example.com/v${version}`, isLate, submittedById: by.id } });
const setDue = (m, dueAt) => prisma.milestone.update({ where: { id: m.id }, data: { dueAt } });

describe('submit — POST /api/milestones/:id/submissions (FR-15)', () => {
  it('TEST-05-05 a member of an approved team submits version 1 on time for their own team; body fields are ignored (AC-05-01)', async () => {
    const res = await submit(await as(s1), m1, { url: ' https://github.com/team-alpha/cpms ', note: 'first version', teamId: beta.id, isLate: true, version: 7 });

    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({
      milestoneId: m1.id,
      teamId: alpha.id,
      version: 1,
      url: 'https://github.com/team-alpha/cpms',
      note: 'first version',
      isLate: false,
      submittedBy: { id: s1.id, displayName: 'Student One' },
    });
    const stored = await rows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ teamId: alpha.id, version: 1, isLate: false, submittedById: s1.id });
  });

  it('TEST-05-06 invalid input → 400 naming the field; nothing stored (AC-05-02)', async () => {
    const c = await as(s1);
    for (const [body, field] of [
      [{}, 'url'],
      [{ url: 'javascript:alert(1)' }, 'url'],
      [{ url: 'https://github.com/x', note: 'x'.repeat(1001) }, 'note'],
    ]) {
      const res = await submit(c, m1, body);
      expect(res.status, JSON.stringify(body).slice(0, 40)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty(field);
    }
    expect(await rows()).toEqual([]);
  });

  it('TEST-05-07 a team without an APPROVED proposal cannot submit (AC-05-03, BR-10)', async () => {
    const c = await as(s3); // Team Beta
    const cases = [null, 'DRAFT', 'SUBMITTED', 'REJECTED'];
    let proposal = null;
    for (const status of cases) {
      if (status) {
        proposal = proposal
          ? await prisma.proposal.update({ where: { id: proposal.id }, data: { status } })
          : await prisma.proposal.create({ data: { teamId: beta.id, title: 'Beta idea', description: 'd', status } });
      }
      const res = await submit(c, m1);
      expect(res.status, String(status)).toBe(409);
      expect(res.body.error.code).toBe('PROPOSAL_NOT_APPROVED');
      expect(res.body.submission).toBeUndefined();
    }
    expect(await rows()).toEqual([]);
  });
});

describe('versions and lateness (FR-16, BR-11)', () => {
  it('TEST-05-08 resubmitting before the due date adds a version and keeps the old ones; concurrent submissions get distinct versions (AC-05-04)', async () => {
    const v1 = await addVersion(m1, alpha, 1, false);
    const res = await submit(await as(s2), m1, { url: 'https://github.com/team-alpha/cpms/tree/v2' });
    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({ version: 2, isLate: false, submittedBy: { id: s2.id } });
    expect(await prisma.submission.findUnique({ where: { id: v1.id } })).toEqual(v1);

    const [a, b] = await Promise.all([submit(await as(s1), m1), submit(await as(s2), m1)]);
    expect([a.status, b.status]).toEqual([201, 201]);
    expect([a.body.submission.version, b.body.submission.version].sort()).toEqual([3, 4]);
    expect((await rows({ milestoneId: m1.id })).map((r) => r.version)).toEqual([1, 2, 3, 4]);
  });

  it('TEST-05-09 after the due date a first submission is accepted and marked LATE (AC-05-05)', async () => {
    await setDue(m1, new Date(Date.now() - MIN));
    const res = await submit(await as(s1), m1);
    expect(res.status).toBe(201);
    expect(res.body.submission).toMatchObject({ version: 1, isLate: true });
    expect((await rows())[0].isLate).toBe(true);
  });

  it('TEST-05-10 after the due date: refused once an on-time version exists, accepted while all versions are late (AC-05-06)', async () => {
    await addVersion(m1, alpha, 1, false);
    await setDue(m1, new Date(Date.now() - MIN));
    const closed = await submit(await as(s1), m1);
    expect(closed.status).toBe(409);
    expect(closed.body.error.code).toBe('RESUBMISSION_CLOSED');
    expect(await rows({ milestoneId: m1.id })).toHaveLength(1);

    await addVersion(m2, alpha, 1, true);
    await setDue(m2, new Date(Date.now() - MIN));
    const again = await submit(await as(s1), m2);
    expect(again.status).toBe(201);
    expect(again.body.submission).toMatchObject({ version: 2, isLate: true });
  });
});

describe('views (FR-14, FR-16)', () => {
  it('TEST-05-11 status per milestone; students see only their team\'s versions; the instructor sees every team (AC-05-07)', async () => {
    await addVersion(m1, alpha, 1, false);
    await addVersion(m1, alpha, 2, false, s2);
    await addVersion(m2, alpha, 1, true);

    const list = await request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', await as(s1));
    expect(list.status).toBe(200);
    expect(list.body.milestones.map((m) => [m.id, m.teamStatus])).toEqual([
      [m1.id, 'SUBMITTED'],
      [m2.id, 'LATE'],
    ]);
    const betaList = await request(app).get(`/api/courses/${course.id}/milestones`).set('Cookie', await as(s3));
    expect(betaList.body.milestones.map((m) => m.teamStatus)).toEqual(['NOT_SUBMITTED', 'NOT_SUBMITTED']);

    const mine = await view(await as(s1), m1);
    expect(mine.status).toBe(200);
    expect(mine.body.team).toEqual({ id: alpha.id, name: 'Team Alpha' });
    expect(mine.body.current).toMatchObject({ version: 2, submittedBy: { id: s2.id } });
    expect(mine.body.versions.map((v) => v.version)).toEqual([2, 1]);

    const inst = await view(await as(instructor1), m1);
    expect(inst.status).toBe(200);
    expect(inst.body.teams.map((t) => [t.team.name, t.current?.version ?? null, t.versionCount])).toEqual([
      ['Team Alpha', 2, 2],
      ['Team Beta', null, 0],
    ]);
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-05-12 instructors cannot submit; outsiders are refused; no team → 409; teams never see each other\'s versions (AC-05-08)', async () => {
    await addVersion(m1, alpha, 1, false);
    const before = await rows();

    const inst = await submit(await as(instructor1), m1);
    expect(inst.status).toBe(403);
    const co = await as(outsider);
    for (const res of [await submit(co, m1), await view(co, m1), await view(await as(instructor2), m1)]) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.versions).toBeUndefined();
      expect(res.body.teams).toBeUndefined();
    }
    const noTeam = await submit(await as(s5), m1);
    expect(noTeam.status).toBe(409);
    expect(noTeam.body.error.code).toBe('NO_TEAM');

    const betaView = await view(await as(s3), m1);
    expect(betaView.status).toBe(200);
    expect(betaView.body.team).toEqual({ id: beta.id, name: 'Team Beta' });
    expect(betaView.body.versions).toEqual([]);
    expect(JSON.stringify(betaView.body)).not.toContain('example.com/v1');
    expect(await rows()).toEqual(before);
  });

  it('TEST-05-13 a milestone with submissions cannot be deleted (AC-05-09, F-04 M4)', async () => {
    await addVersion(m1, alpha, 1, false);
    const res = await request(app).delete(`/api/milestones/${m1.id}`).set('Cookie', await as(instructor1));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MILESTONE_HAS_SUBMISSIONS');
    expect(await prisma.milestone.findUnique({ where: { id: m1.id } })).not.toBeNull();
    expect(await rows()).toHaveLength(1);
  });

  it('TEST-05-14 every F-05 endpoint rejects requests without a session (AC-05-10)', async () => {
    for (const res of [
      await request(app).post(`/api/milestones/${m1.id}/submissions`).send({ url: 'https://x.org' }),
      await request(app).get(`/api/milestones/${m1.id}/submissions`),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
    expect(await rows()).toEqual([]);
  });
});
