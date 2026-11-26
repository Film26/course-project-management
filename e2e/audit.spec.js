// TEST-09-12 (AC-09-10) — UI end-to-end journey for F-09 Audit Log, step A1 (proposal decisions).
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Proposals and audit
// entries of the seeded course are cleared there first, then two SUBMITTED proposals are created.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-3/evidence/screenshots';

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' }, include: { teams: true } });
    await prisma.auditEntry.deleteMany({ where: { courseId: course.id } }); // DELETE is allowed; only UPDATE is blocked
    await prisma.proposal.deleteMany({ where: { team: { courseId: course.id } } });
    const team = (name) => course.teams.find((t) => t.name === name);
    await prisma.proposal.createMany({
      data: [
        { teamId: team('Team Beta').id, title: 'Campus Lost & Found', description: 'Report and claim lost items', status: 'SUBMITTED', submittedAt: new Date() },
        { teamId: team('Team Alpha').id, title: 'Smart Parking', description: 'Find free parking spaces', status: 'SUBMITTED', submittedAt: new Date() },
      ],
    });
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

test('TEST-09-12 instructor rejects and approves; the audit log shows both decisions, newest first', async ({ page }) => {
  await login(page, 'instructor1@cpms.test');

  // 1. Empty log before any decision
  await page.getByRole('button', { name: 'Audit log' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — audit log' })).toBeVisible();
  await expect(page.getByText('No activity yet.')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();

  // 2. Reject Team Beta's proposal with a reason, then approve Team Alpha's (F-02 screens)
  await page.getByRole('button', { name: 'Review proposals' }).click();
  const betaRow = page.locator('li', { hasText: 'Campus Lost & Found' });
  await betaRow.getByRole('button', { name: 'Reject' }).click();
  await betaRow.getByLabel('Reason for rejection').fill('Scope is too broad for one semester');
  await betaRow.getByRole('button', { name: 'Confirm reject' }).click();
  await expect(page.locator('li', { hasText: 'Campus Lost & Found' })).toHaveCount(0); // gone from "Submitted"
  await page.locator('li', { hasText: 'Smart Parking' }).getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('No proposals.')).toBeVisible();
  await page.getByRole('button', { name: '← Back' }).click();

  // 3. The audit log shows both entries, newest first, with actor, team and reason (FR-22)
  await page.getByRole('button', { name: 'Audit log' }).click();
  const entries = page.getByTestId('audit-entry');
  await expect(entries).toHaveCount(2);
  await expect(entries.nth(0)).toContainText('Proposal approved');
  await expect(entries.nth(0)).toContainText('Approved "Smart Parking"');
  await expect(entries.nth(0)).toContainText('By Instructor One · Team Alpha');
  await expect(entries.nth(1)).toContainText('Rejected "Campus Lost & Found": Scope is too broad for one semester');
  await expect(entries.nth(1)).toContainText('Team Beta');
  await page.screenshot({ path: `${shots}/F09-1-audit-log.png`, fullPage: true });

  // 4. Filter by action
  await page.getByLabel('Action').selectOption('PROPOSAL_REJECTED');
  await expect(entries).toHaveCount(1);
  await expect(entries.first()).toContainText('Proposal rejected');
  await page.screenshot({ path: `${shots}/F09-2-filter-rejected.png`, fullPage: true });
});
