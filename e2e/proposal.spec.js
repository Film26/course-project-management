// TEST-02-20 (AC-02-14) — UI end-to-end journey for F-02 Project Proposal Workflow.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Proposals of the seeded
// course are cleared in that database first so the journey can be repeated. Password comes from server/.env.e2e.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';
const shots = 'docs/sprints/sprint-1/evidence/screenshots';

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    await prisma.proposal.deleteMany({ where: { team: { course: { code: 'CPE334' } } } });
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

async function createAndSubmit(page, title, description) {
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByTestId('current-proposal').getByTestId('status')).toHaveText('DRAFT');
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  await expect(page.getByTestId('current-proposal').getByTestId('status')).toHaveText('SUBMITTED');
}

test('TEST-02-20 student submits → instructor rejects with reason → resubmit → instructor approves', async ({ page }) => {
  // 1. Student (Team Beta) creates and submits a proposal (FR-05, FR-06)
  await login(page, 'student3@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — Team Beta' })).toBeVisible();
  await expect(page.getByText('Your team has no proposal yet.')).toBeVisible();

  // Client-side validation before anything is sent
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(page.getByText('Title is required')).toBeVisible();
  await page.screenshot({ path: `${shots}/F02-1-student-validation.png` });

  await createAndSubmit(page, 'Campus Lost & Found', 'A web app to report and claim lost items on campus.');
  await page.screenshot({ path: `${shots}/F02-2-student-submitted.png` });
  await logout(page);

  // 2. Instructor sees it under "Submitted" and rejects with a reason (FR-07, FR-08, BR-04)
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  const row = page.locator('li', { hasText: 'Campus Lost & Found' });
  await expect(row.getByTestId('status')).toHaveText('SUBMITTED');
  await row.getByRole('button', { name: 'Reject' }).click();
  await row.getByRole('button', { name: 'Confirm reject' }).click();
  await expect(row.getByText('A reason is required')).toBeVisible();
  await row.getByLabel('Reason for rejection').fill('Scope overlaps another team; please narrow it to one faculty.');
  await page.screenshot({ path: `${shots}/F02-3-instructor-reject-reason.png` });
  await row.getByRole('button', { name: 'Confirm reject' }).click();
  await expect(page.getByText('No proposals.')).toBeVisible(); // nothing left under "Submitted"
  await page.getByLabel('Status').selectOption('REJECTED');
  await expect(page.locator('li', { hasText: 'Campus Lost & Found' }).getByTestId('status')).toHaveText('REJECTED');
  await logout(page);

  // 3. Student sees the reason, creates a new proposal and submits it (FR-09, BR-01 after rejection)
  await login(page, 'student3@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await expect(page.getByTestId('rejection')).toContainText('please narrow it to one faculty');
  await page.screenshot({ path: `${shots}/F02-4-student-sees-rejection.png` });
  await createAndSubmit(page, 'Engineering Faculty Lost & Found', 'Lost-and-found for the Faculty of Engineering only.');
  await logout(page);

  // 4. Instructor approves (FR-08)
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  await page.locator('li', { hasText: 'Engineering Faculty Lost & Found' }).getByRole('button', { name: 'Approve' }).click();
  await page.getByLabel('Status').selectOption('');
  await expect(page.locator('li', { hasText: 'Engineering Faculty Lost & Found' }).getByTestId('status')).toHaveText('APPROVED');
  await page.screenshot({ path: `${shots}/F02-5-instructor-all-proposals.png` });
  await logout(page);

  // 5. Student retrieves the persisted result after a fresh login (FR-09)
  await login(page, 'student3@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await expect(page.getByTestId('current-proposal').getByTestId('status')).toHaveText('APPROVED');
  await expect(page.getByText('Approved by Instructor One')).toBeVisible();
  await expect(page.getByText('Reason: Scope overlaps another team')).toBeVisible(); // history kept (D-05)
  await page.screenshot({ path: `${shots}/F02-6-student-approved.png`, fullPage: true });
});

test('TEST-02-20b student of another team is forbidden by the API, not just the UI (AC-02-10, AC-02-11)', async ({ page }) => {
  await login(page, 'student1@cpms.test'); // Team Alpha
  await expect(page.getByRole('button', { name: 'Review proposals' })).toHaveCount(0);

  const { courses } = await (await page.request.get('/api/courses')).json();
  const list = await page.request.get(`/api/courses/${courses[0].id}/proposals`);
  expect(list.status()).toBe(403);

  // Team Beta's approved proposal from the journey above (or any Beta proposal) is not readable by Alpha.
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  const betaProposal = await prisma.proposal.findFirst({ where: { team: { name: 'Team Beta' } } });
  await prisma.$disconnect();
  test.skip(!betaProposal, 'needs the TEST-02-20 journey to run first');

  const res = await page.request.get(`/api/proposals/${betaProposal.id}`);
  expect(res.status()).toBe(403);
  expect((await res.json()).proposal).toBeUndefined();
  await page.goto(`/api/proposals/${betaProposal.id}`);
  await expect(page.locator('body')).toContainText('FORBIDDEN');
  await page.screenshot({ path: `${shots}/F02-7-other-team-403.png` });
});
