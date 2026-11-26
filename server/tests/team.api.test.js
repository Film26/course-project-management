// F-03 API/DB integration tests — TEST-03-02, TEST-03-05 … TEST-03-16 (docs/sprints/sprint-2/F-03-teams.md §7)
// Every negative test also checks the database, so a rejected request is proven to leave no partial data (NFR-06).
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;

let s1, s2, s3, s4, s5, s6, outsider, instructor1, instructor2;
let course, otherCourse, alpha, beta;

beforeEach(async () => {
  await resetDb();
  s1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  s2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  s3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  s4 = await createUser({ email: 'student4@cpms.test', displayName: 'Student Four' });
  s5 = await createUser({ email: 'student5@cpms.test', displayName: 'Student Five' });
  s6 = await createUser({ email: 'student6@cpms.test', displayName: 'Student Six' });
  outsider = await createUser({ email: 'student7@cpms.test', displayName: 'Not Enrolled' });
  instructor1 = await createUser({ email: 'instructor1@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor One' });
  instructor2 = await createUser({ email: 'instructor2@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor Two' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructor1.id, proposalDeadline: new Date(Date.now() + 30 * DAY), minTeamSize: 2, maxTeamSize: 3 },
  });
  otherCourse = await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructor2.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  // s1–s6 are enrolled in CPE334; s5 and s6 have no team. The outsider is enrolled nowhere.
  await prisma.enrollment.createMany({ data: [s1, s2, s3, s4, s5, s6].map((s) => ({ courseId: course.id, userId: s.id })) });
  alpha = await makeTeam('Team Alpha', 'ALPHA234', [s1, s2]);
  beta = await makeTeam('Team Beta', 'BETA2345', [s3, s4]);
  // A team in another course, to prove codes are looked up in the requested course only.
  await prisma.team.create({ data: { name: 'Team Zeta', joinCode: 'ZETA2345', courseId: otherCourse.id } });
});

afterAll(() => prisma.$disconnect());

function makeTeam(name, joinCode, members, courseId = course.id) {
  return prisma.team.create({
    data: { name, joinCode, courseId, members: { create: members.map((u) => ({ userId: u.id, courseId })) } },
  });
}
const addMember = (team, user) => prisma.teamMember.create({ data: { teamId: team.id, userId: user.id, courseId: team.courseId } });
const memberIds = async (team) =>
  (await prisma.teamMember.findMany({ where: { teamId: team.id }, orderBy: { userId: 'asc' } })).map((m) => m.userId);
const teamCount = () => prisma.team.count({ where: { courseId: course.id } });
const memberships = () => prisma.teamMember.findMany({ orderBy: [{ teamId: 'asc' }, { userId: 'asc' }] });

/** Log in through the real F-01 endpoint and return the session cookie. */
async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}
const create = (c, name, courseId = course.id) => request(app).post(`/api/courses/${courseId}/teams`).set('Cookie', c).send({ name });
const join = (c, joinCode, courseId = course.id) => request(app).post(`/api/courses/${courseId}/teams/join`).set('Cookie', c).send({ joinCode });
const leave = (c, team) => request(app).post(`/api/teams/${team.id}/leave`).set('Cookie', c);

describe('join codes (T7)', () => {
  it('TEST-03-02 every team gets a unique 8-character code from the allowed alphabet (AC-03-01)', async () => {
    await prisma.team.createMany({ data: Array.from({ length: 200 }, (_, i) => ({ name: `Bulk ${i}`, courseId: otherCourse.id })) });
    const codes = (await prisma.team.findMany({ select: { joinCode: true } })).map((t) => t.joinCode);
    expect(codes.length).toBeGreaterThan(200);
    for (const code of codes) expect(code).toMatch(CODE);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('create team — POST /api/courses/:courseId/teams (FR-10)', () => {
  it('TEST-03-05 an enrolled student without a team creates one and is its only member; userId in the body is ignored (AC-03-01)', async () => {
    const res = await request(app)
      .post(`/api/courses/${course.id}/teams`)
      .set('Cookie', await as(s5))
      .send({ name: ' Team Gamma ', userId: s6.id });

    expect(res.status).toBe(201);
    expect(res.body.team).toMatchObject({
      name: 'Team Gamma',
      courseId: course.id,
      members: [{ id: s5.id, displayName: 'Student Five' }],
      memberCount: 1,
      locked: false,
    });
    expect(res.body.team.joinCode).toMatch(CODE);
    const team = await prisma.team.findUnique({ where: { id: res.body.team.id } });
    expect(team).toMatchObject({ name: 'Team Gamma', courseId: course.id, joinCode: res.body.team.joinCode });
    expect(await memberIds(team)).toEqual([s5.id]);
    expect(await prisma.teamMember.count({ where: { userId: s6.id } })).toBe(0);
  });

  it('TEST-03-06 an invalid or duplicate team name is rejected and nothing is stored (AC-03-02)', async () => {
    const c = await as(s5);
    for (const body of [{}, { name: '   ' }, { name: 'x'.repeat(61) }]) {
      const res = await request(app).post(`/api/courses/${course.id}/teams`).set('Cookie', c).send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toHaveProperty('name');
    }
    const dup = await create(c, 'Team Alpha');
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('TEAM_NAME_TAKEN');
    expect(await teamCount()).toBe(2);
    expect(await prisma.teamMember.count({ where: { userId: s5.id } })).toBe(0);
  });
});

describe('join team — POST /api/courses/:courseId/teams/join (FR-11, BR-06, BR-07)', () => {
  it('TEST-03-07 an enrolled student joins with a valid code; lower case and spaces are accepted (AC-03-03)', async () => {
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s5]);
    const res = await join(await as(s6), ' gamma234 ');
    expect(res.status).toBe(200);
    expect(res.body.team).toMatchObject({ id: gamma.id, memberCount: 2, joinCode: 'GAMMA234' });
    expect(await memberIds(gamma)).toEqual([s5.id, s6.id]);
  });

  it('TEST-03-08 a student already in a team cannot create or join another; concurrent joins store one membership (AC-03-04, BR-06)', async () => {
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s6]);
    const c1 = await as(s1);
    const before = await memberships();

    const again = await create(c1, 'Team Two');
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_IN_TEAM');
    const other = await join(c1, 'GAMMA234');
    expect(other.status).toBe(409);
    expect(other.body.error.code).toBe('ALREADY_IN_TEAM');
    expect(await memberships()).toEqual(before);
    expect(await teamCount()).toBe(3);

    // Two joins by the same student at the same time: exactly one membership is stored.
    const c5 = await as(s5);
    const [a, b] = await Promise.all([join(c5, 'GAMMA234'), join(c5, 'BETA2345')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await prisma.teamMember.count({ where: { userId: s5.id, courseId: course.id } })).toBe(1);
    expect((await memberIds(gamma)).length + (await memberIds(beta)).length).toBe(4);
  });

  it('TEST-03-09 the max-th member is accepted, a full team is rejected, and two joins for the last place store one (AC-03-05, BR-07)', async () => {
    // Free the Beta students so they can join another team.
    await prisma.teamMember.deleteMany({ where: { teamId: beta.id } });
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s5]);

    expect((await join(await as(s3), 'GAMMA234')).status).toBe(200); // 2nd member
    expect((await join(await as(s4), 'GAMMA234')).status).toBe(200); // 3rd = maxTeamSize: boundary accepted
    const full = await join(await as(s6), 'GAMMA234'); // 4th
    expect(full.status).toBe(409);
    expect(full.body.error.code).toBe('TEAM_FULL');
    expect(await memberIds(gamma)).toHaveLength(3);
    expect(await prisma.teamMember.count({ where: { userId: s6.id } })).toBe(0);

    // Last place: Delta has 2 members, two different students join at the same time.
    const s8 = await createUser({ email: 'student8@cpms.test', displayName: 'Student Eight' });
    await prisma.enrollment.create({ data: { courseId: course.id, userId: s8.id } });
    await prisma.teamMember.deleteMany({ where: { teamId: alpha.id } });
    const delta = await makeTeam('Team Delta', 'DELTA234', [s1, s6]);
    const [a, b] = await Promise.all([join(await as(s2), 'DELTA234'), join(await as(s8), 'DELTA234')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await memberIds(delta)).toHaveLength(3);
  });

  it('TEST-03-10 a malformed code → 400; a code of no team in this course (also another course\'s team) → 404 (AC-03-06)', async () => {
    const c = await as(s5);
    const before = await memberships();

    const bad = await join(c, 'ABC');
    expect(bad.status).toBe(400);
    expect(bad.body.error.details).toHaveProperty('joinCode');
    for (const code of ['ZZZZ2222', 'ZETA2345']) {
      const res = await join(c, code);
      expect(res.status, code).toBe(404);
      expect(res.body.team).toBeUndefined();
    }
    expect(await memberships()).toEqual(before);
  });
});

describe('leave team — POST /api/teams/:teamId/leave (FR-12, BR-08)', () => {
  it('TEST-03-11 a member leaves; the last member leaving deletes a team without proposals and keeps one with proposals (AC-03-07)', async () => {
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s5, s6]);
    const first = await leave(await as(s6), gamma);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ left: true, teamDeleted: false });
    expect(await memberIds(gamma)).toEqual([s5.id]);

    const last = await leave(await as(s5), gamma);
    expect(last.status).toBe(200);
    expect(last.body).toEqual({ left: true, teamDeleted: true });
    expect(await prisma.team.findUnique({ where: { id: gamma.id } })).toBeNull();

    const delta = await makeTeam('Team Delta', 'DELTA234', [s5]);
    await prisma.proposal.create({ data: { teamId: delta.id, title: 'Old idea', description: 'd', status: 'REJECTED', rejectReason: 'Too broad' } });
    const keep = await leave(await as(s5), delta);
    expect(keep.status).toBe(200);
    expect(keep.body).toEqual({ left: true, teamDeleted: false });
    expect(await prisma.team.findUnique({ where: { id: delta.id } })).not.toBeNull();
    expect(await prisma.proposal.count({ where: { teamId: delta.id } })).toBe(1);
  });

  it('TEST-03-12 an APPROVED proposal locks join and leave; a team with only a REJECTED proposal is not locked (AC-03-08, BR-08)', async () => {
    await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'd', status: 'APPROVED' } });
    await prisma.proposal.create({ data: { teamId: beta.id, title: 'Old idea', description: 'd', status: 'REJECTED', rejectReason: 'Too broad' } });
    const before = await memberIds(alpha);

    const out = await leave(await as(s2), alpha);
    expect(out.status).toBe(409);
    expect(out.body.error.code).toBe('MEMBERSHIP_LOCKED');
    const into = await join(await as(s5), 'ALPHA234');
    expect(into.status).toBe(409);
    expect(into.body.error.code).toBe('MEMBERSHIP_LOCKED');
    expect(await memberIds(alpha)).toEqual(before);

    expect((await leave(await as(s4), beta)).status).toBe(200);
    expect(await memberIds(beta)).toEqual([s3.id]);
  });
});

describe('BR-07 on proposal submit — POST /api/proposals/:id/submit (F-02 v1.3)', () => {
  it('TEST-03-13 a team below the minimum size cannot submit; with exactly the minimum it can (AC-03-09)', async () => {
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s5]);
    const draft = await prisma.proposal.create({ data: { teamId: gamma.id, title: 'Campus Lost & Found', description: 'd' } });
    const c = await as(s5);

    const small = await request(app).post(`/api/proposals/${draft.id}/submit`).set('Cookie', c);
    expect(small.status).toBe(409);
    expect(small.body.error.code).toBe('TEAM_TOO_SMALL');
    expect(await prisma.proposal.findUnique({ where: { id: draft.id } })).toMatchObject({ status: 'DRAFT', submittedAt: null });

    await addMember(gamma, s6);
    const ok = await request(app).post(`/api/proposals/${draft.id}/submit`).set('Cookie', c);
    expect(ok.status).toBe(200);
    expect(ok.body.proposal.status).toBe('SUBMITTED');
  });
});

describe('access control (NFR-02, NFR-03)', () => {
  it('TEST-03-14 instructors, students outside the course and non-members are refused (AC-03-10)', async () => {
    const before = await memberships();
    const ci = await as(instructor1);
    const co = await as(outsider);
    const c3 = await as(s3);

    const attempts = [
      create(ci, 'Instructor Team'),
      join(ci, 'ALPHA234'),
      leave(ci, alpha),
      create(co, 'Outsider Team'),
      join(co, 'ALPHA234'),
      request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', co),
      leave(c3, alpha),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.team).toBeUndefined();
      expect(JSON.stringify(res.body)).not.toContain('ALPHA234');
    }
    expect(await memberships()).toEqual(before);
    expect(await teamCount()).toBe(2);
  });

  it('TEST-03-15 every F-03 endpoint rejects requests without a session (AC-03-11)', async () => {
    const attempts = [
      request(app).post(`/api/courses/${course.id}/teams`).send({ name: 'x' }),
      request(app).post(`/api/courses/${course.id}/teams/join`).send({ joinCode: 'ALPHA234' }),
      request(app).post(`/api/teams/${alpha.id}/leave`),
    ];
    for (const res of await Promise.all(attempts)) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('views (FR-10, FR-04)', () => {
  it('TEST-03-16 members see their code and size; the instructor sees codes and unassigned students; other teams never see a code (AC-03-12)', async () => {
    const mine = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', await as(s1));
    expect(mine.status).toBe(200);
    expect(mine.body.team).toMatchObject({ id: alpha.id, joinCode: 'ALPHA234', locked: false });
    expect(mine.body.course).toMatchObject({ minTeamSize: 2, maxTeamSize: 3 });

    const noTeam = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', await as(s5));
    expect(noTeam.status).toBe(404);

    const roster = await request(app).get(`/api/courses/${course.id}/roster`).set('Cookie', await as(instructor1));
    expect(roster.status).toBe(200);
    expect(roster.body.teams.map((t) => [t.name, t.joinCode])).toEqual([
      ['Team Alpha', 'ALPHA234'],
      ['Team Beta', 'BETA2345'],
    ]);
    expect(roster.body.unassigned.map((u) => u.id)).toEqual([s5.id, s6.id]);

    const otherTeam = await request(app).get(`/api/courses/${course.id}/my-team`).set('Cookie', await as(s3));
    expect(otherTeam.status).toBe(200);
    expect(JSON.stringify(otherTeam.body)).not.toContain('ALPHA234');

    // F-01 change: a student sees a course they are enrolled in even without a team.
    const courses = await request(app).get('/api/courses').set('Cookie', await as(s5));
    expect(courses.body.courses.map((c) => c.code)).toEqual(['CPE334']);
  });
});

// PR #59 review (jaruwan18): BR-07 must also hold when the proposal is approved, not only when it is submitted.
describe('BR-07 on approval — PR #59 review (F-03 v1.3, F-02 v1.5)', () => {
  it('TEST-03-13b a member leaves after submit; approving the now too-small team → 409 TEAM_TOO_SMALL, proposal stays SUBMITTED (AC-03-09)', async () => {
    const gamma = await makeTeam('Team Gamma', 'GAMMA234', [s5, s6]);
    const p = await prisma.proposal.create({ data: { teamId: gamma.id, title: 'Gamma idea', description: 'd', status: 'SUBMITTED', submittedAt: new Date() } });

    // SUBMITTED does not lock membership (BR-08 locks at APPROVED), so s6 may leave.
    expect((await leave(await as(s6), gamma)).status).toBe(200);

    const ci = await as(instructor1);
    const res = await request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', ci);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('TEAM_TOO_SMALL');
    expect(await prisma.proposal.findUnique({ where: { id: p.id } })).toMatchObject({ status: 'SUBMITTED', decidedAt: null, decidedById: null });

    // With the minimum size again, the approval succeeds (boundary = minTeamSize).
    await addMember(gamma, s6);
    const ok = await request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', ci);
    expect(ok.status).toBe(200);
    expect(ok.body.proposal.status).toBe('APPROVED');
  });

  it('TEST-03-13c rejecting a too-small team is still allowed (BR-07 only guards approval)', async () => {
    const delta = await makeTeam('Team Delta', 'DELTA234', [s5]);
    const p = await prisma.proposal.create({ data: { teamId: delta.id, title: 'Delta idea', description: 'd', status: 'SUBMITTED', submittedAt: new Date() } });
    const res = await request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', await as(instructor1)).send({ reason: 'Team is too small' });
    expect(res.status).toBe(200);
    expect(res.body.proposal.status).toBe('REJECTED');
  });

  it('TEST-03-17b a join racing the deletion of an empty team gives 200 or 404, never 500 (PR #59 review point 3)', async () => {
    for (let i = 0; i < 10; i += 1) {
      await prisma.teamMember.deleteMany({ where: { userId: { in: [s5.id, s6.id] } } });
      await prisma.team.deleteMany({ where: { name: 'Team Solo' } });
      const solo = await makeTeam('Team Solo', 'SKYW2345', [s5]);
      const [left, joined] = await Promise.all([leave(await as(s5), solo), join(await as(s6), 'SKYW2345')]);
      expect(left.status, `run ${i}`).toBe(200);
      expect([200, 404], `run ${i}`).toContain(joined.status);
    }
  });
});
