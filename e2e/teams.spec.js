// TEST-03-17 (AC-03-13) — UI end-to-end journey for F-03 Team Formation.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. student5 and student6
// (seeded, enrolled, no team) are taken out of any team and "Team Gamma" is removed first, so the journey repeats.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-2/evidence/screenshots';

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' } });
    const users = await prisma.user.findMany({ where: { email: { in: ['student5@cpms.test', 'student6@cpms.test'] } } });
    await prisma.teamMember.deleteMany({ where: { courseId: course.id, userId: { in: users.map((u) => u.id) } } });
    await prisma.team.deleteMany({ where: { courseId: course.id, name: 'Team Gamma' } });
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

test('TEST-03-17 student5 creates a team, student6 joins with the code and leaves again', async ({ page }) => {
  // 1. student5 has no team: create and join forms; field check before sending
  await login(page, 'student5@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await expect(page.getByRole('heading', { name: 'My team' })).toBeVisible();
  const create = page.getByTestId('create-team');
  await create.getByRole('button', { name: 'Create team' }).click();
  await expect(create.getByText('Team name is required')).toBeVisible();

  // 2. Create "Team Gamma" (FR-10): student5 is the only member and sees the join code
  await create.getByLabel('Team name').fill('Team Gamma');
  await create.getByRole('button', { name: 'Create team' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — Team Gamma' })).toBeVisible();
  await expect(page.getByTestId('team-size')).toHaveText('1 / 3 members (minimum 2)');
  await expect(page.getByTestId('size-warning')).toBeVisible();
  const code = (await page.getByTestId('join-code').textContent()).trim();
  expect(code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  await page.screenshot({ path: `${shots}/F03-1-team-created.png`, fullPage: true });
  await logout(page);

  // 3. student6 joins with the code in lower case (FR-11); both members are listed
  await login(page, 'student6@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  const join = page.getByTestId('join-team');
  await join.getByLabel('Join code').fill(` ${code.toLowerCase()} `);
  await join.getByRole('button', { name: 'Join team' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — Team Gamma' })).toBeVisible();
  await expect(page.getByTestId('team-size')).toHaveText('2 / 3 members (minimum 2)');
  await expect(page.getByTestId('team-info')).toContainText('Student Five, Student Six');
  await expect(page.getByTestId('size-warning')).toHaveCount(0);
  await page.screenshot({ path: `${shots}/F03-2-student6-joined.png`, fullPage: true });

  // 4. student6 leaves (FR-12) and is back to the create/join forms
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Leave team' }).click();
  await expect(page.getByRole('heading', { name: 'My team' })).toBeVisible();
  await expect(page.getByTestId('join-team')).toBeVisible();
  await logout(page);

  // 5. student5 sees one member again and the submit warning (BR-07)
  await login(page, 'student5@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await expect(page.getByTestId('team-size')).toHaveText('1 / 3 members (minimum 2)');
  await expect(page.getByTestId('size-warning')).toBeVisible();
  await page.screenshot({ path: `${shots}/F03-3-after-leave.png`, fullPage: true });
});
