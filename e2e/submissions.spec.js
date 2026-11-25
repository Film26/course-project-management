// TEST-05-15 (AC-05-11) — UI end-to-end journey for F-05 Deliverable Submission.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Team Alpha's proposal is
// set to APPROVED and the submissions of the seeded course are cleared first, so the journey can be repeated.
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
    await prisma.submission.deleteMany({ where: { milestone: { courseId: course.id } } });
    await prisma.proposal.deleteMany({ where: { teamId: alpha.id } });
    await prisma.proposal.create({ data: { teamId: alpha.id, title: 'Smart Parking', description: 'Find free parking spaces', status: 'APPROVED' } });
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

async function openM1(page, button) {
  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.locator('li', { hasText: 'M1 Requirements' }).getByRole('button', { name: button }).click();
  await expect(page.getByRole('heading', { name: 'M1 Requirements — submissions' })).toBeVisible();
}

test('TEST-05-15 two members submit and resubmit M1; the instructor sees the current version per team', async ({ page }) => {
  // 1. student1 (Team Alpha, approved proposal) submits version 1 (FR-15); a non-http link is refused first
  await login(page, 'student1@cpms.test');
  await openM1(page, 'Submit');
  const form = page.getByTestId('submit-form');
  await form.getByLabel('Deliverable URL').fill('github.com/team-alpha');
  await form.getByRole('button', { name: 'Submit deliverable' }).click();
  await expect(form.getByText('Enter a link that starts with http:// or https://')).toBeVisible();
  await form.getByLabel('Deliverable URL').fill('https://github.com/team-alpha/cpms-srs');
  await form.getByLabel('Note').fill('First version of the SRS');
  await form.getByRole('button', { name: 'Submit deliverable' }).click();
  await expect(page.getByTestId('version')).toHaveCount(1);
  await expect(page.getByTestId('version').first()).toContainText('Version 1');
  await logout(page);

  // 2. student2 resubmits (FR-16): version 2 is current, version 1 is kept
  await login(page, 'student2@cpms.test');
  await openM1(page, 'Resubmit / history');
  await page.getByTestId('submit-form').getByLabel('Deliverable URL').fill('https://github.com/team-alpha/cpms-srs/tree/v2');
  await page.getByTestId('submit-form').getByRole('button', { name: 'Submit deliverable' }).click();
  await expect(page.getByTestId('version')).toHaveCount(2);
  await expect(page.getByTestId('version').nth(0)).toContainText('Version 2');
  await expect(page.getByTestId('version').nth(0)).toContainText('Student Two');
  await expect(page.getByTestId('version').nth(1)).toContainText('Version 1');
  await page.screenshot({ path: `${shots}/F05-1-student-versions.png`, fullPage: true });
  await logout(page);

  // 3. The instructor sees Team Alpha "Submitted v2" and Team Beta "Not submitted" (FR-14 from the instructor side)
  await login(page, 'instructor1@cpms.test');
  await openM1(page, 'Submissions');
  await expect(page.getByTestId('team-row-Team Alpha')).toContainText('Submitted v2');
  await expect(page.getByTestId('team-row-Team Alpha')).toContainText('2 version(s)');
  await expect(page.getByTestId('team-row-Team Beta')).toContainText('Not submitted');
  await page.screenshot({ path: `${shots}/F05-2-instructor-view.png`, fullPage: true });
});
