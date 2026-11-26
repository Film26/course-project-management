// Lab 7 change (Issue #74, F-02 contract v1.7): withdraw a submitted proposal, SUBMITTED → DRAFT (BR-03, P9).
// TEST-02-21 … TEST-02-23 and the API part of TEST-02-25 (docs/sprints/sprint-1/F-02-proposal.md §7).
// Every refusal also checks the database (NFR-06). The exact deadline boundary is tested at the service level
// (TEST-02-22 a) because the route always uses the server clock.
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as service from '../src/proposals/service.js';
import { prisma, resetDb, createUser } from './helpers/db.js';

const app = createApp();
const PASSWORD = 'Test-Pass-123';
const DAY = 24 * 60 * 60 * 1000;

let student1, student2, student3, instructorA, instructorB;
let course, alpha, beta;

beforeEach(async () => {
  await resetDb();
  student1 = await createUser({ email: 'student1@cpms.test', displayName: 'Student One' });
  student2 = await createUser({ email: 'student2@cpms.test', displayName: 'Student Two' });
  student3 = await createUser({ email: 'student3@cpms.test', displayName: 'Student Three' });
  instructorA = await createUser({ email: 'inst-a@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor A' });
  instructorB = await createUser({ email: 'inst-b@cpms.test', role: 'INSTRUCTOR', displayName: 'Instructor B' });

  course = await prisma.course.create({
    data: { code: 'CPE334', name: 'Software Engineering', instructorId: instructorA.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  await prisma.course.create({
    data: { code: 'CPE999', name: 'Other Course', instructorId: instructorB.id, proposalDeadline: new Date(Date.now() + 30 * DAY) },
  });
  alpha = await prisma.team.create({
    data: { name: 'Team Alpha', courseId: course.id, members: { create: [{ userId: student1.id, courseId: course.id }, { userId: student2.id, courseId: course.id }] } },
  });
  beta = await prisma.team.create({
    data: { name: 'Team Beta', courseId: course.id, members: { create: [{ userId: student3.id, courseId: course.id }] } },
  });
  await prisma.enrollment.createMany({ data: [student1, student2, student3].map((s) => ({ courseId: course.id, userId: s.id })) });
});

afterAll(() => prisma.$disconnect());

async function as(user) {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
}

const SUBMITTED_AT = new Date('2026-11-20T03:00:00.000Z');
function makeSubmitted(team = alpha, data = {}) {
  return prisma.proposal.create({
    data: { teamId: team.id, title: 'Smart Parking', description: 'IoT parking finder', status: 'SUBMITTED', submittedAt: SUBMITTED_AT, ...data },
  });
}
const reload = (p) => prisma.proposal.findUnique({ where: { id: p.id } });
const withdraw = async (p, cookie) => {
  const req = request(app).post(`/api/proposals/${p.id}/withdraw`);
  return cookie ? req.set('Cookie', cookie) : req;
};
const setDeadline = (date) => prisma.course.update({ where: { id: course.id }, data: { proposalDeadline: date } });

/** The stored proposal is exactly as it was before the refused request. */
async function expectUnchanged(p) {
  const row = await reload(p);
  expect(row.status).toBe(p.status);
  expect(row.submittedAt?.getTime() ?? null).toBe(p.submittedAt?.getTime() ?? null);
  expect(row.title).toBe(p.title);
  expect(row.updatedAt.getTime()).toBe(p.updatedAt.getTime());
}

describe('withdraw — POST /api/proposals/:id/withdraw (Lab 7, BR-03 v0.4)', () => {
  it('TEST-02-21 a member withdraws a SUBMITTED proposal, edits it and submits it again (AC-02-15)', async () => {
    const p = await makeSubmitted();
    const cookie = await as(student2);

    const res = await withdraw(p, cookie);
    expect(res.status).toBe(200);
    expect(res.body.proposal).toMatchObject({ id: p.id, status: 'DRAFT', submittedAt: null, title: 'Smart Parking', description: 'IoT parking finder' });
    const row = await reload(p);
    expect(row).toMatchObject({ status: 'DRAFT', submittedAt: null, title: 'Smart Parking', description: 'IoT parking finder', decidedAt: null, decidedById: null, rejectReason: null });
    expect(await prisma.proposal.count()).toBe(1); // no new row

    const edit = await request(app).patch(`/api/proposals/${p.id}`).set('Cookie', cookie).send({ title: 'Smart Parking v2' });
    expect(edit.status).toBe(200);
    expect(edit.body.proposal.title).toBe('Smart Parking v2');

    const before = Date.now();
    const again = await request(app).post(`/api/proposals/${p.id}/submit`).set('Cookie', cookie);
    expect(again.status).toBe(200);
    expect(again.body.proposal.status).toBe('SUBMITTED');
    const resubmitted = await reload(p);
    expect(resubmitted.submittedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(resubmitted.submittedAt.getTime()).not.toBe(SUBMITTED_AT.getTime());
  });

  it('TEST-02-22 (a) service boundary: now = deadline → DRAFT; deadline + 1 ms → 409 DEADLINE_PASSED, unchanged (AC-02-15, AC-02-16)', async () => {
    const D = new Date('2026-12-01T16:59:59.000Z');
    await setDeadline(D);

    const atDeadline = await makeSubmitted();
    expect(typeof service.withdrawProposal).toBe('function');
    const done = await service.withdrawProposal(atDeadline.id, student2, D);
    expect(done).toMatchObject({ status: 'DRAFT', submittedAt: null });
    expect((await reload(atDeadline)).status).toBe('DRAFT');

    await prisma.proposal.deleteMany();
    const late = await makeSubmitted();
    await expect(service.withdrawProposal(late.id, student2, new Date(D.getTime() + 1))).rejects.toMatchObject({ status: 409, code: 'DEADLINE_PASSED' });
    await expectUnchanged(late);
  });

  it('TEST-02-22 (b) API: deadline in 1 minute → 200; 1 minute ago → 409 DEADLINE_PASSED, unchanged (AC-02-15, AC-02-16)', async () => {
    const cookie = await as(student1);
    await setDeadline(new Date(Date.now() + 60 * 1000));
    const onTime = await makeSubmitted();
    const ok = await withdraw(onTime, cookie);
    expect(ok.status).toBe(200);
    expect(ok.body.proposal.status).toBe('DRAFT');

    await prisma.proposal.deleteMany();
    await setDeadline(new Date(Date.now() - 60 * 1000));
    const late = await makeSubmitted();
    const res = await withdraw(late, cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DEADLINE_PASSED');
    await expectUnchanged(late);
  });

  it('TEST-02-22 (c) only a SUBMITTED proposal can be withdrawn: DRAFT, APPROVED, REJECTED → 409 INVALID_TRANSITION (AC-02-16)', async () => {
    const cookie = await as(student1);
    for (const data of [
      { status: 'DRAFT', submittedAt: null },
      { status: 'APPROVED', decidedAt: new Date(), decidedById: instructorA.id },
      { status: 'REJECTED', decidedAt: new Date(), decidedById: instructorA.id, rejectReason: 'Too broad' },
    ]) {
      await prisma.proposal.deleteMany();
      const p = await makeSubmitted(alpha, data);
      const res = await withdraw(p, cookie);
      expect(res.status, data.status).toBe(409);
      expect(res.body.error.code).toBe('INVALID_TRANSITION');
      await expectUnchanged(p);
    }
  });

  it('TEST-02-23 course instructor, other instructor, other team → 403; no session → 401; unchanged (AC-02-17)', async () => {
    const p = await makeSubmitted();
    for (const user of [instructorA, instructorB, student3]) {
      const res = await withdraw(p, await as(user));
      expect(res.status, user.email).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.proposal).toBeUndefined();
    }
    const anon = await withdraw(p);
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe('UNAUTHENTICATED');
    expect(anon.body.proposal).toBeUndefined();
    await expectUnchanged(p);

    const bad = await request(app).post('/api/proposals/abc/withdraw').set('Cookie', await as(student1));
    expect(bad.status).toBe(400);
    const missing = await request(app).post('/api/proposals/999999/withdraw').set('Cookie', await as(student1));
    expect(missing.status).toBe(404);
  });

  it('TEST-02-25 (API) approve or reject after the team withdrew → 409 INVALID_TRANSITION, still DRAFT, no audit entry (AC-02-19)', async () => {
    const p = await makeSubmitted();
    expect((await withdraw(p, await as(student1))).status).toBe(200);

    const inst = await as(instructorA);
    const approve = await request(app).post(`/api/proposals/${p.id}/approve`).set('Cookie', inst);
    expect(approve.status).toBe(409);
    expect(approve.body.error.code).toBe('INVALID_TRANSITION');
    const reject = await request(app).post(`/api/proposals/${p.id}/reject`).set('Cookie', inst).send({ reason: 'Out of scope' });
    expect(reject.status).toBe(409);
    expect(reject.body.error.code).toBe('INVALID_TRANSITION');

    const row = await reload(p);
    expect(row).toMatchObject({ status: 'DRAFT', decidedAt: null, decidedById: null, rejectReason: null });
    expect(await prisma.auditEntry.count({ where: { entityId: p.id, action: { in: ['PROPOSAL_APPROVED', 'PROPOSAL_REJECTED'] } } })).toBe(0);
  });
});
