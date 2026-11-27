// Lab 7 change (Issue #74, F-02 contract v1.7) — UI end-to-end tests for withdrawing a submitted proposal.
// TEST-02-24 (AC-02-18): student submits → Withdraw submission → edits → submits again; instructor sees the new title.
// TEST-02-25 (AC-02-19): the instructor's list is open while the team withdraws; Approve → message + list refreshed.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Proposals of the seeded
// course are cleared there first so the tests can be repeated.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/labs/lab07/evidence';

async function clearProposals() {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    await prisma.proposal.deleteMany({ where: { team: { course: { code: 'CPE334' } } } });
  } finally {
    await prisma.$disconnect();
  }
}

test.beforeEach(clearProposals);

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

const status = (page) => page.getByTestId('current-proposal').getByTestId('status');

async function createAndSubmit(page, title, description) {
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Description').fill(description);
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expect(status(page)).toHaveText('DRAFT');
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  await expect(status(page)).toHaveText('SUBMITTED');
}

test('TEST-02-24 student withdraws a submitted proposal, edits it and submits again (AC-02-18)', async ({ page }) => {
  // 1. Student (Team Beta) submits a proposal
  await login(page, 'student3@cpms.test');
  await createAndSubmit(page, 'Campus Lost & Found', 'A web app to report and claim lost items on campus.');
  await page.screenshot({ path: `${shots}/L7-1-student-submitted-withdraw-button.png` });

  // 2. Withdraw (confirm dialog) → back to DRAFT, edit form shown again
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Withdraw submission' }).click();
  await expect(status(page)).toHaveText('DRAFT');
  await expect(page.getByRole('button', { name: 'Withdraw submission' })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/L7-2-student-withdrawn-draft.png` });

  // 3. Edit the title and submit again
  await page.getByLabel('Title').fill('Engineering Faculty Lost & Found');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  await expect(status(page)).toHaveText('SUBMITTED');
  await logout(page);

  // 4. Instructor sees only the new title under "Submitted"
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  await expect(page.locator('li', { hasText: 'Engineering Faculty Lost & Found' }).getByTestId('status')).toHaveText('SUBMITTED');
  await expect(page.locator('li', { hasText: 'Campus Lost & Found' }).filter({ hasNotText: 'Engineering' })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/L7-3-instructor-sees-resubmission.png` });
});

test('TEST-02-25 instructor approves a proposal the team withdrew meanwhile → message, list refreshed (AC-02-19)', async ({ page, browser }) => {
  // 1. Student submits; instructor opens the Submitted list
  const student = await (await browser.newContext()).newPage();
  await login(student, 'student3@cpms.test');
  await createAndSubmit(student, 'Campus Lost & Found', 'A web app to report and claim lost items on campus.');

  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  const row = page.locator('li', { hasText: 'Campus Lost & Found' });
  await expect(row.getByTestId('status')).toHaveText('SUBMITTED');

  // 2. The team withdraws while the instructor's list is still open
  student.once('dialog', (d) => d.accept());
  await student.getByRole('button', { name: 'Withdraw submission' }).click();
  await expect(status(student)).toHaveText('DRAFT');

  // 3. Approve on the stale row → 409 explained, list reloaded, the proposal is no longer listed
  await row.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByRole('alert')).toHaveText('This proposal is no longer submitted. The list has been refreshed.');
  await expect(page.locator('li', { hasText: 'Campus Lost & Found' })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/L7-4-instructor-stale-approve.png` });

  // 4. Still DRAFT and no audit entry for the refused decision (FR-22)
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const p = await prisma.proposal.findFirstOrThrow({ where: { title: 'Campus Lost & Found' } });
    expect(p.status).toBe('DRAFT');
    expect(await prisma.auditEntry.count({ where: { entityId: p.id, action: 'PROPOSAL_APPROVED' } })).toBe(0);
  } finally {
    await prisma.$disconnect();
  }
});
