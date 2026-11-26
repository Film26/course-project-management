// TEST-06-12 (AC-06-09) — UI end-to-end journey for F-06 Grading & Feedback.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Setup: Team Alpha has an
// approved proposal and one version for "M1 Requirements", whose due date is moved to the past so the grade can be
// released (D-08 v1.1: release only after the due date). Earlier submissions/grades of the course are cleared.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-2/evidence/screenshots';

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' } });
    const alpha = await prisma.team.findFirstOrThrow({ where: { courseId: course.id, name: 'Team Alpha' } });
    const student1 = await prisma.user.findUniqueOrThrow({ where: { email: 'student1@cpms.test' } });
    await prisma.submission.deleteMany({ where: { milestone: { courseId: course.id } } }); // grades cascade
    await prisma.proposal.deleteMany({ where: { teamId: alpha.id } });
    await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'Find free parking spaces', status: 'APPROVED' } });
    let m1 = await prisma.milestone.findFirst({ where: { courseId: course.id, title: 'M1 Requirements' } });
    if (!m1) m1 = await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(), weight: 20, maxScore: 100 } });
    await prisma.milestone.update({ where: { id: m1.id }, data: { dueAt: new Date(Date.now() - 60 * 60 * 1000), maxScore: 100 } });
    await prisma.submission.create({ data: { milestoneId: m1.id, teamId: alpha.id, version: 1, url: 'https://github.com/team-alpha/cpms-srs', isLate: false, submittedById: student1.id } });
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

async function logout(page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
}

async function myGrades(page) {
  await page.getByRole('button', { name: 'My grades' }).click();
  await expect(page.getByRole('heading', { name: /my grades/ })).toBeVisible();
}

test('TEST-06-12 instructor grades Team Alpha M1, students see it only after release and only for their team', async ({ page }) => {
  // 1. Instructor saves 85 / 100 with feedback (FR-17); the form checks the range first
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.locator('li', { hasText: 'M1 Requirements' }).getByRole('button', { name: 'Submissions' }).click();
  const row = page.getByTestId('team-row-Team Alpha');
  await row.getByLabel('Score (of 100)').fill('101');
  await row.getByLabel('Feedback').fill('Clear and complete requirements');
  await row.getByRole('button', { name: 'Save grade' }).click();
  await expect(row.getByText('Score must be a whole number from 0 to 100')).toBeVisible();
  await row.getByLabel('Score (of 100)').fill('85');
  await row.getByRole('button', { name: 'Save grade' }).click();
  await expect(row.getByText('Graded (not released)')).toBeVisible();
  await page.screenshot({ path: `${shots}/F06-1-instructor-graded.png`, fullPage: true });
  await logout(page);

  // 2. Before release the student sees nothing (BR-12)
  await login(page, 'student1@cpms.test');
  await myGrades(page);
  await expect(page.getByText('No released grades yet.')).toBeVisible();
  await logout(page);

  // 3. Instructor releases (after the due date, D-08)
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.locator('li', { hasText: 'M1 Requirements' }).getByRole('button', { name: 'Submissions' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('team-row-Team Alpha').getByRole('button', { name: 'Release' }).click();
  await expect(page.getByTestId('released-grade')).toContainText('85 / 100 released');
  await logout(page);

  // 4. student1 sees 85 / 100 with the feedback (FR-18); student3 (Team Beta) sees none
  await login(page, 'student1@cpms.test');
  await myGrades(page);
  await expect(page.getByTestId('my-grade')).toHaveCount(1);
  await expect(page.getByTestId('my-grade')).toContainText('85 / 100');
  await expect(page.getByTestId('my-grade')).toContainText('Clear and complete requirements');
  await page.screenshot({ path: `${shots}/F06-2-student-released.png`, fullPage: true });
  await logout(page);

  await login(page, 'student3@cpms.test');
  await myGrades(page);
  await expect(page.getByText('No released grades yet.')).toBeVisible();
});
