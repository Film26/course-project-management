// F-09 step A1 API/DB integration tests — TEST-09-03 … TEST-09-09 (docs/sprints/sprint-3/F-09-audit.md §7)
// The audit entry and the decision it records must be written together or not at all (L1, NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let student1, instructor1, instructor2, course, alpha, beta;

beforeEach(async () => {
  await resetDb();
  student1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  const student3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  // BR-07 at approval (F-02 v1.5): teams need minTeamSize (2) members to be approved, so each team has two.
  const student2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  const student4 = await createUser({ email: 'student4@cpms.test', displayName: 'Student Four' });
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  // Sync with sprint-2 (F-03): a membership records its course (BR-06 unique per course).
  alpha = await prisma.team.create({ data: { name: 'Team Alpha', courseId: course.id, members: { create: [student1, student2].map((u) => ({ userId: u.id, courseId: course.id })) } } });
  beta = await prisma.team.create({ data: { name: 'Team Beta', courseId: course.id, members: { create: [student3, student4].map((u) => ({ userId: u.id, courseId: course.id })) } } });
});

afterAll(() => prisma.$disconnect());

/** Log in through the real F-01 endpoint and return the session cookie. */
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
const submitted = (team, title = 'Smart Parking') =>
  prisma.proposal.create({ data: { teamId: team.id, title, description: 'd', status: 'SUBMITTED', submittedAt: new Date() } });
const approve = (c, p) => request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', c);
const reject = (c, p, reason) => request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', c).send({ reason });
const audit = (c, query = '') => request(app).get(`/api/courses/${course.id}/audit${query}`).set('Cookie', c);
const entries = () => prisma.auditEntry.findMany({ orderBy: { id: 'asc' } });

describe('recording proposal decisions (A1)', () => {
  it('TEST-09-03 approving stores one PROPOSAL_APPROVED entry with actor, team, proposal id and title (AC-09-01)', async () => {
    const p = await submitted(alpha);
    const res = await approve(await as(instructor1), p);
    expect(res.status).toBe(200);

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      courseId: course.id,
      actorId: instructor1.id,
      teamId: alpha.id,
      action: 'PROPOSAL_APPROVED',
      entityId: p.id,
      details: { title: 'Smart Parking' },
    });
  });

  it('TEST-09-04 rejecting stores one PROPOSAL_REJECTED entry that contains the reason (AC-09-02)', async () => {
    const p = await submitted(beta, 'Campus Lost & Found');
    const res = await reject(await as(instructor1), p, '  Too broad ');
    expect(res.status).toBe(200);

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: instructor1.id,
      teamId: beta.id,
      action: 'PROPOSAL_REJECTED',
      entityId: p.id,
      details: { title: 'Campus Lost & Found', reason: 'Too broad' },
    });
  });

  it('TEST-09-05 a decision request that is refused stores no entry (AC-09-03)', async () => {
    const p = await submitted(alpha);
    const draft = await prisma.proposal.create({ data: { teamId: beta.id, title: 'Draft', description: 'd' } });
    const c1 = await as(instructor1);

    expect((await reject(c1, p, '   ')).status).toBe(400);
    expect((await approve(await as(instructor2), p)).status).toBe(403);
    expect((await request(app).post('/api/proposals/999999/approve').set('Cookie', c1)).status).toBe(404);
    expect((await approve(c1, draft)).status).toBe(409);
    expect(await entries()).toEqual([]);
  });

  it('TEST-09-06 if the audit entry cannot be written, the decision is rolled back (AC-09-04, L1)', async () => {
    const p = await submitted(alpha);
    // Test-only fault: make every AuditEntry insert fail, then remove the fault again.
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION test_fail_audit_insert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'test: audit insert fails'; END; $$`);
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER test_fail_audit_insert BEFORE INSERT ON "AuditEntry" FOR EACH ROW EXECUTE FUNCTION test_fail_audit_insert()',
    );
    try {
      const res = await approve(await as(instructor1), p);
      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(JSON.stringify(res.body)).not.toContain('audit insert fails'); // NFR-05: no internal detail
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_fail_audit_insert ON "AuditEntry"');
      await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_audit_insert()');
    }
    expect(await prisma.proposal.findUnique({ where: { id: p.id } })).toMatchObject({ status: 'SUBMITTED', decidedAt: null, decidedById: null });
    expect(await entries()).toEqual([]);
  });
});

describe('reading the log — GET /api/courses/:courseId/audit (FR-22)', () => {
  it('TEST-09-07 newest first, filtered by action, paged with limit and before; invalid query → 400 (AC-09-05)', async () => {
    const c = await as(instructor1);
    const decided = [];
    for (const [i, kind] of ['approve', 'reject', 'approve', 'reject', 'approve'].entries()) {
      const p = await submitted(i % 2 ? beta : alpha, `Idea ${i + 1}`);
      const res = kind === 'approve' ? await approve(c, p) : await reject(c, p, `Reason ${i + 1}`);
      expect(res.status).toBe(200);
      decided.push(p.id);
    }

    const all = await audit(c);
    expect(all.status).toBe(200);
    expect(all.body.course).toMatchObject({ id: course.id, code: 'CPE334' });
    expect(all.body.entries.map((e) => e.entityId)).toEqual([...decided].reverse());
    expect(all.body.entries[0]).toMatchObject({
      action: 'PROPOSAL_APPROVED',
      actor: { id: instructor1.id, displayName: 'Instructor One' },
      team: { id: alpha.id, name: 'Team Alpha' },
      details: { title: 'Idea 5' },
    });
    expect(all.body.entries[0].actor).not.toHaveProperty('email');
    expect(all.body.nextBefore).toBeNull();

    const rejected = await audit(c, '?action=PROPOSAL_REJECTED');
    expect(rejected.body.entries.map((e) => e.details.reason)).toEqual(['Reason 4', 'Reason 2']);

    const page1 = await audit(c, '?limit=2');
    expect(page1.body.entries).toHaveLength(2);
    expect(page1.body.nextBefore).toBe(page1.body.entries[1].id);
    const page2 = await audit(c, `?limit=2&before=${page1.body.nextBefore}`);
    const page3 = await audit(c, `?limit=2&before=${page2.body.nextBefore}`);
    expect([...page1.body.entries, ...page2.body.entries, ...page3.body.entries].map((e) => e.entityId)).toEqual([...decided].reverse());
    expect(page3.body.entries).toHaveLength(1);
    expect(page3.body.nextBefore).toBeNull();

    for (const q of ['?limit=0', '?limit=101', '?before=abc', '?action=BOGUS']) {
      const res = await audit(c, q);
      expect(res.status, q).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('TEST-09-08 only the course instructor reads the log (AC-09-06)', async () => {
    const p = await submitted(alpha);
    await approve(await as(instructor1), p);

    for (const user of [student1, instructor2]) {
      const res = await audit(await as(user));
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.entries).toBeUndefined();
    }
    const anon = await request(app).get(`/api/courses/${course.id}/audit`);
    expect(anon.status).toBe(401);
    expect(anon.body.entries).toBeUndefined();
    expect((await request(app).get('/api/courses/999999/audit').set('Cookie', await as(instructor1))).status).toBe(404);
    expect((await request(app).get('/api/courses/abc/audit').set('Cookie', await as(instructor1))).status).toBe(400);
  });

  it('TEST-09-09 an entry cannot be changed in the database (AC-09-07, L2)', async () => {
    const entry = await prisma.auditEntry.create({
      data: { courseId: course.id, actorId: instructor1.id, teamId: alpha.id, action: 'PROPOSAL_APPROVED', entityId: 1, details: { title: 'X' } },
    });
    await expect(prisma.$executeRaw`UPDATE "AuditEntry" SET "details" = '{"title":"changed"}' WHERE id = ${entry.id}`).rejects.toThrow(/append-only/);
    expect((await prisma.auditEntry.findUnique({ where: { id: entry.id } })).details).toEqual({ title: 'X' });
  });
});

// Steps A2 / A3 (contract v1.1 L6): the feature that makes the change writes the entry in its own transaction.
describe('recording membership changes and grade release (A2, A3)', () => {
  it('TEST-09-10 create, join and leave each store one entry with the student as actor and the team name (AC-09-08)', async () => {
    const s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' });
    const s6 = await createUser({ email: 'student6@cpms.test', displayName: 'Student Six' });
    await prisma.enrollment.createMany({ data: [s5, s6].map((s) => ({ courseId: course.id, userId: s.id })) });

    const created = await request(app).post(`/api/courses/${course.id}/teams`).set('Cookie', await as(s5)).send({ name: 'Team Gamma' });
    expect(created.status).toBe(201);
    const { id: teamId, joinCode } = created.body.team;
    expect((await request(app).post(`/api/courses/${course.id}/teams/join`).set('Cookie', await as(s6)).send({ joinCode })).status).toBe(200);
    expect((await request(app).post(`/api/teams/${teamId}/leave`).set('Cookie', await as(s6))).status).toBe(200);

    const rows = await entries();
    expect(rows.map((r) => [r.action, r.actorId, r.teamId, r.entityId, r.details])).toEqual([
      ['TEAM_CREATED', s5.id, teamId, teamId, { teamName: 'Team Gamma' }],
      ['MEMBER_JOINED', s6.id, teamId, teamId, { teamName: 'Team Gamma' }],
      ['MEMBER_LEFT', s6.id, teamId, teamId, { teamName: 'Team Gamma' }],
    ]);
    expect(rows.every((r) => r.courseId === course.id)).toBe(true);
  });

  it('TEST-09-10b the last member leaving an empty team is recorded before the team is deleted; refused requests store nothing (AC-09-08, F-03 T6)', async () => {
    const s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' });
    await prisma.enrollment.create({ data: { courseId: course.id, userId: s5.id } });
    const c5 = await as(s5);
    const { team } = (await request(app).post(`/api/courses/${course.id}/teams`).set('Cookie', c5).send({ name: 'Team Solo' })).body;

    expect((await request(app).post(`/api/courses/${course.id}/teams`).set('Cookie', c5).send({ name: 'Second' })).status).toBe(409); // BR-06
    const left = await request(app).post(`/api/teams/${team.id}/leave`).set('Cookie', c5);
    expect(left.body).toEqual({ left: true, teamDeleted: true });

    const rows = await entries();
    expect(rows.map((r) => r.action)).toEqual(['TEAM_CREATED', 'MEMBER_LEFT']);
    expect(rows[1]).toMatchObject({ teamId: team.id, details: { teamName: 'Team Solo' } });
    expect(await prisma.team.findUnique({ where: { id: team.id } })).toBeNull();
  });

  it('TEST-09-11 releasing a grade stores one GRADE_RELEASED entry with milestone, score and max score; saving a grade stores none (AC-09-09)', async () => {
    const milestone = await prisma.milestone.create({
      data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() - 60 * 1000), weight: 20, maxScore: 100 },
    });
    const sub = await prisma.submission.create({ data: { milestoneId: milestone.id, teamId: alpha.id, version: 1, url: 'https://example.com/v1', isLate: false, submittedById: student1.id } });
    const c = await as(instructor1);

    expect((await request(app).put(`/api/submissions/${sub.id}/grade`).set('Cookie', c).send({ score: 85, feedback: 'Private feedback' })).status).toBe(200);
    expect(await entries()).toEqual([]);
    expect((await request(app).post(`/api/submissions/${sub.id}/grade/release`).set('Cookie', c)).status).toBe(200);

    const rows = await entries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: 'GRADE_RELEASED',
      actorId: instructor1.id,
      teamId: alpha.id,
      entityId: sub.id,
      details: { milestoneTitle: 'M1 Requirements', score: 85, maxScore: 100 },
    });
    expect(JSON.stringify(rows[0].details)).not.toContain('Private feedback'); // L3 whitelist
  });
});
