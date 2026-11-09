// F-02 API/DB integration tests — TEST-02-05 … TEST-02-19 (docs/sprints/sprint-1/F-02-proposal.md §7)
// Every negative test also checks the database, so a rejected request is proven to leave no partial data (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let student1, student2, student3, student4, instructorA, instructorB;
let course, alpha, beta;

beforeEach(async () => {
  await resetDb();
  student1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  student2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  student3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  student4 = await createUser({ email: 'student4@cpms.test', displayName: 'No Team' });
  instructorA = await createUser({ email: 'inst-a@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor A' });
  instructorB = await createUser({ email: 'inst-b@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor B' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructorA.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  // Instructor B owns a different course.
  await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructorB.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  alpha = await prisma.team.create({
    data: { name: 'Team Alpha', courseId: course.id, members: { create: [{ userId: student1.id }, { userId: student2.id }] } },
  });
  beta = await prisma.team.create({
    data: { name: 'Team Beta', courseId: course.id, members: { create: [{ userId: student3.id }] } },
  });
});

afterAll(() => prisma.$disconnect());

/** Log in through the real F-01 endpoint and return the session cookie. */
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
function makeProposal(team, data = {}) {
  return prisma.proposal.create({
    data: { teamId: team.id, title: 'Smart Parking', description: 'IoT parking finder', ...data },
  });
}

const reload = (p) => prisma.proposal.findUnique({ where: { id: p.id } });

describe('create proposal — POST /api/teams/:teamId/proposals', () => {
  it('TEST-02-05 a team member creates a DRAFT for their own team; client-supplied status/teamId are ignored (AC-02-01)', async () => {
    const c = await as(student1);
    const res = await request(app)
      .post(`/api/teams/${alpha.id}/proposals`)
      .set('Cookie', c)
      .send({ title: '  Smart Parking ', description: 'Find free parking spaces', status: 'APPROVED', teamId: beta.id });

    expect(res.status).toBe(201);
    expect(res.body.proposal).toMatchObject({
      teamId: alpha.id,
      title: 'Smart Parking',
      description: 'Find free parking spaces',
      status: 'DRAFT',
      submittedAt: null,
      decidedAt: null,
      decidedBy: null,
      rejectReason: null,
    });
    const rows = await prisma.proposal.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: res.body.proposal.id, teamId: alpha.id, status: 'DRAFT' });
  });

  it('TEST-02-06 a second active proposal is rejected while DRAFT, SUBMITTED or APPROVED exists (AC-02-02, BR-01)', async () => {
    const existing = await makeProposal(alpha);
    const c = await as(student2);
    for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED']) {
      await prisma.proposal.update({ where: { id: existing.id }, data: { status } });
      const res = await request(app)
        .post(`/api/teams/${alpha.id}/proposals`)
        .set('Cookie', c)
        .send({ title: 'Another idea', description: 'Second proposal' });
      expect(res.status, status).toBe(409);
      expect(res.body.error.code).toBe('ACTIVE_PROPOSAL_EXISTS');
      expect(res.body.proposal).toBeUndefined();
    }
    expect(await prisma.proposal.count()).toBe(1);
  });

  it('TEST-02-07 after a rejection the team may create a new proposal and the rejected one is kept (AC-02-02, D-05)', async () => {
    const old = await makeProposal(alpha, { status: 'REJECTED', rejectReason: 'Too broad' });
    const res = await request(app)
      .post(`/api/teams/${alpha.id}/proposals`)
      .set('Cookie', await as(student1))
      .send({ title: 'Narrower idea', description: 'Focused scope' });

    expect(res.status).toBe(201);
    const rows = await prisma.proposal.findMany({ where: { teamId: alpha.id }, orderBy: { id: 'asc' } });
    expect(rows.map((r) => [r.id, r.status])).toEqual([
      [old.id, 'REJECTED'],
      [res.body.proposal.id, 'DRAFT'],
    ]);
  });

  it('TEST-02-08 concurrent creates for the same team store exactly one proposal (AC-02-02, NFR-06)', async () => {
    const c1 = await as(student1);
    const c2 = await as(student2);
    const results = await Promise.all(
      [c1, c2, c1, c2, c1].map((c, i) =>
        request(app).post(`/api/teams/${alpha.id}/proposals`).set('Cookie', c).send({ title: `Idea ${i}`, description: 'Race' }),
      ),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.proposal.count({ where: { teamId: alpha.id } })).toBe(1);
  });

  it('TEST-02-09 invalid input → 400 VALIDATION_ERROR naming the fields, nothing stored or changed (AC-02-03)', async () => {
    const c = await as(student1);
    const empty = await request(app).post(`/api/teams/${alpha.id}/proposals`).set('Cookie', c).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(empty.body.error.details).sort()).toEqual(['description', 'title']);

    const blank = await request(app).post(`/api/teams/${alpha.id}/proposals`).set('Cookie', c).send({ title: '  ', description: 'ok' });
    expect(blank.status).toBe(400);
    expect(blank.body.error.details.title).toBeDefined();
    expect(await prisma.proposal.count()).toBe(0);

    const draft = await makeProposal(alpha);
    const long = await request(app).patch(`/api/proposals/${draft.id}`).set('Cookie', c).send({ title: 'x'.repeat(121) });
    expect(long.status).toBe(400);
    expect(long.body.error.details.title).toBeDefined();
    expect((await reload(draft)).title).toBe('Smart Parking');

    const badId = await request(app).post('/api/teams/abc/proposals').set('Cookie', c).send({ title: 't', description: 'd' });
    expect(badId.status).toBe(400);
    const unknownTeam = await request(app).post('/api/teams/99999/proposals').set('Cookie', c).send({ title: 't', description: 'd' });
    expect(unknownTeam.status).toBe(404);
  });
});

describe('edit and submit — PATCH /api/proposals/:id, POST /api/proposals/:id/submit', () => {
  it('TEST-02-10 a DRAFT can be edited; a SUBMITTED proposal cannot (AC-02-04)', async () => {
    const p = await makeProposal(alpha);
    const c = await as(student2);
    const ok = await request(app).patch(`/api/proposals/${p.id}`).set('Cookie', c).send({ title: 'Smart Parking v2' });
    expect(ok.status).toBe(200);
    expect(ok.body.proposal).toMatchObject({ title: 'Smart Parking v2', description: 'IoT parking finder', status: 'DRAFT' });

    await prisma.proposal.update({ where: { id: p.id }, data: { status: 'SUBMITTED' } });
    const locked = await request(app).patch(`/api/proposals/${p.id}`).set('Cookie', c).send({ title: 'Sneaky edit' });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('INVALID_TRANSITION');
    expect((await reload(p)).title).toBe('Smart Parking v2');
  });

  it('TEST-02-11 a member submits a DRAFT before the deadline → SUBMITTED with submittedAt (AC-02-05)', async () => {
    const p = await makeProposal(alpha);
    const before = Date.now();
    const res = await request(app).post(`/api/proposals/${p.id}/submit`).set('Cookie', await as(student1));
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('SUBMITTED');

    const row = await reload(p);
    expect(row.status).toBe('SUBMITTED');
    expect(row.submittedAt).not.toBeNull();
    expect(row.submittedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });

  it('TEST-02-12 submit after the course deadline → 409 DEADLINE_PASSED, still DRAFT (AC-02-06, BR-02)', async () => {
    await prisma.course.update({ where: { id: course.id }, data: { proposalDeadline: new Date(Date.now() - 60 * 1000) } });
    const p = await makeProposal(alpha);
    const res = await request(app).post(`/api/proposals/${p.id}/submit`).set('Cookie', await as(student1));
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEADLINE_PASSED');
    const row = await reload(p);
    expect(row.status).toBe('DRAFT');
    expect(row.submittedAt).toBeNull();
  });

  it('TEST-02-13 transitions outside the state machine → 409 INVALID_TRANSITION, status unchanged (AC-02-07, BR-03)', async () => {
    const student = await as(student1);
    const inst = await as(instructorA);

    const submitted = await makeProposal(alpha, { status: 'SUBMITTED', submittedAt: new Date() });
    const again = await request(app).post(`/api/proposals/${submitted.id}/submit`).set('Cookie', student);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('INVALID_TRANSITION');
    expect((await reload(submitted)).status).toBe('SUBMITTED');

    const draft = await makeProposal(beta);
    const approveDraft = await request(app).post(`/api/proposals/${draft.id}/approve`).set('Cookie', inst);
    expect(approveDraft.status).toBe(409);
    expect(approveDraft.body.error.code).toBe('INVALID_TRANSITION');
    expect((await reload(draft)).status).toBe('DRAFT');

    await prisma.proposal.update({ where: { id: submitted.id }, data: { status: 'APPROVED' } });
    const rejectApproved = await request(app).post(`/api/proposals/${submitted.id}/reject`).set('Cookie', inst).send({ reason: 'Changed my mind' });
    expect(rejectApproved.status).toBe(409);
    expect((await reload(submitted)).status).toBe('APPROVED');

    await prisma.proposal.update({ where: { id: draft.id }, data: { status: 'REJECTED', rejectReason: 'No' } });
    const approveRejected = await request(app).post(`/api/proposals/${draft.id}/approve`).set('Cookie', inst);
    expect(approveRejected.status).toBe(409);
    expect((await reload(draft)).status).toBe('REJECTED');
  });
});

describe('decide — POST /api/proposals/:id/approve | reject', () => {
  it('TEST-02-14 the course instructor approves a SUBMITTED proposal; decider and time are stored (AC-02-08)', async () => {
    const p = await makeProposal(alpha, { status: 'SUBMITTED', submittedAt: new Date() });
    const res = await request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', await as(instructorA));
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ status: 'APPROVED', decidedBy: { id: instructorA.id, displayName: 'Instructor A' } });

    const row = await reload(p);
    expect(row.status).toBe('APPROVED');
    expect(row.decidedById).toBe(instructorA.id);
    expect(row.decidedAt).not.toBeNull();
  });

  it('TEST-02-15 reject needs a reason of 1–500 chars; invalid reasons change nothing (AC-02-09, BR-04)', async () => {
    const p = await makeProposal(alpha, { status: 'SUBMITTED', submittedAt: new Date() });
    const c = await as(instructorA);

    for (const body of [{}, { reason: '   ' }, { reason: 'r'.repeat(501) }]) {
      const res = await request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', c).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.reason).toBeDefined();
    }
    const unchanged = await reload(p);
    expect(unchanged.status).toBe('SUBMITTED');
    expect(unchanged.decidedAt).toBeNull();

    const ok = await request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', c).send({ reason: '  Scope is too large for one semester  ' });
    expect(ok.status).toBe(200);
    expect(ok.body.proposal).toMatchObject({ status: 'REJECTED', rejectReason: 'Scope is too large for one semester' });
    const row = await reload(p);
    expect(row).toMatchObject({ status: 'REJECTED', rejectReason: 'Scope is too large for one semester', decidedById: instructorA.id });
    expect(row.decidedAt).not.toBeNull();
  });
});

describe('access control (BR-05, NFR-02, NFR-03)', () => {
  it('TEST-02-16 a non-member student and an instructor cannot create, read, edit or submit a team proposal (AC-02-10)', async () => {
    const p = await makeProposal(alpha);
    const outsider = await as(student3);
    const inst = await as(instructorA);

    const attempts = [
      request(app).post(`/api/teams/${alpha.id}/proposals`).set('Cookie', outsider).send({ title: 'Hijack', description: 'x' }),
      request(app).get(`/api/proposals/${p.id}`).set('Cookie', outsider),
      request(app).patch(`/api/proposals/${p.id}`).set('Cookie', outsider).send({ title: 'Hijack' }),
      request(app).post(`/api/proposals/${p.id}/submit`).set('Cookie', outsider),
      request(app).post(`/api/teams/${alpha.id}/proposals`).set('Cookie', inst).send({ title: 'By instructor', description: 'x' }),
      request(app).patch(`/api/proposals/${p.id}`).set('Cookie', inst).send({ title: 'By instructor' }),
      request(app).post(`/api/proposals/${p.id}/submit`).set('Cookie', inst),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.proposal).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('IoT parking finder');
    }
    const rows = await prisma.proposal.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ title: 'Smart Parking', status: 'DRAFT' });
  });

  it('TEST-02-17 students cannot list or decide; an instructor of another course cannot read, list or decide (AC-02-11)', async () => {
    const p = await makeProposal(alpha, { status: 'SUBMITTED', submittedAt: new Date() });
    const student = await as(student1);
    const other = await as(instructorB);

    const attempts = [
      request(app).get(`/api/courses/${course.id}/proposals`).set('Cookie', student),
      request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', student),
      request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', student).send({ reason: 'self-reject' }),
      request(app).get(`/api/proposals/${p.id}`).set('Cookie', other),
      request(app).get(`/api/courses/${course.id}/proposals`).set('Cookie', other),
      request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', other),
      request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', other).send({ reason: 'Not mine to decide' }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.proposal).toBeUndefined();
      expect(res.body.proposals).toBeUndefined();
    }
    const row = await reload(p);
    expect(row).toMatchObject({ status: 'SUBMITTED', decidedById: null, rejectReason: null });
  });

  it('TEST-02-18 every F-02 endpoint rejects requests without a session (AC-02-12)', async () => {
    const p = await makeProposal(alpha);
    const attempts = [
      request(app).get(`/api/courses/${course.id}/my-team`),
      request(app).get(`/api/courses/${course.id}/proposals`),
      request(app).post(`/api/teams/${alpha.id}/proposals`).send({ title: 't', description: 'd' }),
      request(app).get(`/api/proposals/${p.id}`),
      request(app).patch(`/api/proposals/${p.id}`).send({ title: 't' }),
      request(app).post(`/api/proposals/${p.id}/submit`),
      request(app).post(`/api/proposals/${p.id}/approve`),
      request(app).post(`/api/proposals/${p.id}/reject`).send({ reason: 'r' }),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
      expect(res.body.proposal).toBeUndefined();
      expect(res.body.proposals).toBeUndefined();
    }
    expect(await prisma.proposal.count()).toBe(1);
  });
});

describe('view proposals (FR-07, FR-09)', () => {
  it('TEST-02-19 members see their team and decisions; the instructor lists and filters the course (AC-02-13)', async () => {
    const rejected = await makeProposal(alpha, {
      status: 'REJECTED',
      rejectReason: 'Too broad',
      submittedAt: new Date(Date.now() - 2 * DAY),
      decidedAt: new Date(Date.now() - DAY),
      decidedById: instructorA.id,
    });
    const current = await makeProposal(alpha, { title: 'Narrow Parking', status: 'SUBMITTED', submittedAt: new Date() });
    await makeProposal(beta, { title: 'Beta Draft' });

    // Student member: own team, history newest first, decision reason visible.
    const s = await as(student1);
    const mine = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', s);
    expect(mine.status).toBe(200);
    expect(mine.body.course).toMatchObject({ id: course.id, code: 'CPE334' });
    expect(mine.body.course.proposalDeadline).toBeDefined();
    expect(mine.body.team).toMatchObject({ id: alpha.id, name: 'Team Alpha' });
    expect(mine.body.team.members.map((m) => m.displayName).sort()).toEqual(['Student One', 'Student Two']);
    expect(mine.body.proposals.map((p) => p.id)).toEqual([current.id, rejected.id]);
    expect(mine.body.proposals[1]).toMatchObject({ status: 'REJECTED', rejectReason: 'Too broad', decidedBy: { id: instructorA.id } });
    expect(JSON.stringify(mine.body)).not.toContain('Beta Draft');
    expect(JSON.stringify(mine.body)).not.toMatch(/passwordHash|email/);

    const one = await request(app).get(`/api/proposals/${rejected.id}`).set('Cookie', s);
    expect(one.status).toBe(200);
    expect(one.body).toMatchObject({
      proposal: { id: rejected.id, status: 'REJECTED', rejectReason: 'Too broad' },
      team: { id: alpha.id, name: 'Team Alpha' },
      course: { id: course.id, code: 'CPE334' },
    });

    // Instructor: whole course, filter by status, invalid filter, unknown id.
    const i = await as(instructorA);
    const all = await request(app).get(`/api/courses/${course.id}/proposals`).set('Cookie', i);
    expect(all.status).toBe(200);
    expect(all.body.proposals).toHaveLength(3);
    expect(all.body.proposals.map((p) => p.team.name)).toEqual(['Team Alpha', 'Team Alpha', 'Team Beta']);

    const submitted = await request(app).get(`/api/courses/${course.id}/proposals?status=SUBMITTED`).set('Cookie', i);
    expect(submitted.status).toBe(200);
    expect(submitted.body.proposals).toHaveLength(1);
    expect(submitted.body.proposals[0]).toMatchObject({ id: current.id, title: 'Narrow Parking', team: { id: alpha.id, name: 'Team Alpha' } });

    const bogus = await request(app).get(`/api/courses/${course.id}/proposals?status=BOGUS`).set('Cookie', i);
    expect(bogus.status).toBe(400);
    expect(bogus.body.error.details.status).toBeDefined();

    const instView = await request(app).get(`/api/proposals/${current.id}`).set('Cookie', i);
    expect(instView.status).toBe(200);

    expect((await request(app).get('/api/proposals/99999').set('Cookie', i)).status).toBe(404);
    expect((await request(app).get(`/api/courses/99999/proposals`).set('Cookie', i)).status).toBe(404);

    // A student without a team in the course, and an instructor asking for "my team".
    const lonely = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', await as(student4));
    expect(lonely.status).toBe(404);
    expect(lonely.body.team).toBeUndefined();
    const instMyTeam = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', i);
    expect(instMyTeam.status).toBe(403);
  });
});
