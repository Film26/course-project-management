// TEST-08-07 (AC-08-07) — UI end-to-end journey for F-08 Course Dashboard.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Setup (TEST-08-03 data):
// Team Alpha APPROVED with M1 v1 + v2 on time and 85 released on v2; Team Beta without a proposal or submission.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-3/evidence/screenshots';

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' } });
    const alpha = await prisma.team.findFirstOrThrow({ where: { courseId: course.id, name: 'Team Alpha' } });
    const beta = await prisma.team.findFirstOrThrow({ where: { courseId: course.id, name: 'Team Beta' } });
    const student1 = await prisma.user.findUniqueOrThrow({ where: { email: 'student1@cpms.test' } });
    const instructor1 = await prisma.user.findUniqueOrThrow({ where: { email: 'instructor1@cpms.test' } });
    await prisma.submission.deleteMany({ where: { milestone: { courseId: course.id } } }); // grades cascade
    await prisma.proposal.deleteMany({ where: { teamId: { in: [alpha.id, beta.id] } } });
    await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'Find free parking spaces', status: 'APPROVED', decidedAt: new Date() } });
    let m1 = await prisma.milestone.findFirst({ where: { courseId: course.id, title: 'M1 Requirements' } });
    if (!m1) m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(), weight: 20, maxScore: 100 } });
    await prisma.milestone.update({ where: { id: m1.id }, data: { maxScore: 100 } });
    const sub = (version) => ({ milestoneId: m1.id, teamId: alpha.id, version, url: `https://github.com/team-alpha/cpms-srs/v${version}`, isLate: false, submittedById: student1.id });
    await prisma.submission.create({ data: sub(1) });
    const v2 = await prisma.submission.create({ data: sub(2) });
    await prisma.grade.create({ data: { submissionId: v2.id, score: 85, feedback: 'Clear requirements', gradedById: instructor1.id, gradedAt: new Date(), releasedAt: new Date() } });
  } finally {
    await prisma.$disconnect();
  }
});

async function login(page, email) {
  await page.goto('/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByTestId('current-user')).toBeVisible();
}

test('TEST-08-07 instructor1 sees Team Alpha APPROVED with M1 "Submitted v2" and "85 / 100 ✓", Team Beta without a proposal', async ({ page }) => {
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — dashboard' })).toBeVisible();

  const alpha = page.getByTestId('dashboard-row-Team Alpha');
  await expect(alpha.getByTestId('proposal-status')).toHaveText('APPROVED');
  const m1 = alpha.getByTestId('cell-M1 Requirements');
  await expect(m1).toContainText('Submitted v2');
  await expect(m1).toContainText('85 / 100 ✓');
  await expect(alpha.getByTestId('weighted')).toHaveText('17.00'); // 85 / 100 × 20 %

  const beta = page.getByTestId('dashboard-row-Team Beta');
  await expect(beta.getByTestId('proposal-status')).toHaveText('No proposal');
  await expect(beta.getByTestId('cell-M1 Requirements')).toHaveText('Not submitted');
  await expect(page.getByTestId('dashboard-totals')).toContainText('Approved 1');
  await page.screenshot({ path: `${shots}/F08-1-instructor-dashboard.png`, fullPage: true });

  // A student has no Dashboard button, and the API itself refuses them (D5, AC-08-05).
  await page.getByRole('button', { name: 'Log out' }).click();
  await login(page, 'student1@cpms.test');
  await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveCount(0);
  const courses = await page.request.get('/api/courses');
  const courseId = (await courses.json()).courses.find((c) => c.code === 'CPE334').id;
  const api = await page.request.get(`/api/courses/${courseId}/dashboard`);
  expect(api.status()).toBe(403);
});
