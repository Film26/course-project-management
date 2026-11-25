// TEST-04-12 (AC-04-09) — UI end-to-end journey for F-04 Course Milestones.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. The milestones of the
// seeded course are reset to the three seed milestones (total 90 %) first, so the journey can be repeated.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-2/evidence/screenshots';
const SEED_MILESTONES = [
  { title: 'M1 Requirements', description: 'SRS, feature inventory and Sprint 1 contracts', dueAt: '2026-12-01T16:59:00Z', weight: 20, maxScore: 100 },
  { title: 'M2 Design', description: 'System-level SDS and Sprint 2 contracts', dueAt: '2026-12-06T16:59:00Z', weight: 30, maxScore: 100 },
  { title: 'M3 Final release', description: 'Deployed final release and demonstration video', dueAt: '2026-12-13T16:59:00Z', weight: 40, maxScore: 100 },
];

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' } });
    await prisma.submission.deleteMany({ where: { milestone: { courseId: course.id } } }); // F-05: RESTRICT on milestone
    await prisma.milestone.deleteMany({ where: { courseId: course.id } });
    await prisma.milestone.createMany({ data: SEED_MILESTONES.map((m) => ({ ...m, dueAt: new Date(m.dueAt), courseId: course.id })) });
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

async function fillMilestone(form, { title, dueAt, weight }) {
  await form.getByLabel('Title').fill(title);
  await form.getByLabel('Due date (Bangkok time)').fill(dueAt);
  await form.getByLabel('Weight (%)').fill(String(weight));
}

test('TEST-04-12 instructor adds a milestone up to 100 %, is stopped at 101 %, edits it; student sees the list', async ({ page }) => {
  // 1. Instructor opens the milestones of CPE334: the three seed milestones, total 90 % (FR-13)
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await expect(page.getByRole('heading', { name: 'CPE334 — milestones' })).toBeVisible();
  await expect(page.getByTestId('total-weight')).toHaveText('Total weight: 90 / 100 %');

  // Client-side field checks before anything is sent
  await page.getByRole('button', { name: 'Add milestone' }).click();
  let form = page.getByTestId('milestone-form');
  await form.getByRole('button', { name: 'Create milestone' }).click();
  await expect(form.getByText('Title is required')).toBeVisible();
  await expect(form.getByText('Due date is required')).toBeVisible();

  // 2. Add "M4 Demo" with 10 % → total exactly 100 % (BR-09 boundary)
  await fillMilestone(form, { title: 'M4 Demo', dueAt: '2026-12-12T18:00', weight: 10 });
  await form.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByTestId('total-weight')).toHaveText('Total weight: 100 / 100 %');
  await expect(page.getByText('M4 Demo')).toBeVisible();
  await page.screenshot({ path: `${shots}/F04-1-instructor-total-100.png`, fullPage: true });

  // 3. One more 1 % milestone is rejected by the API (BR-09), nothing is added
  await page.getByRole('button', { name: 'Add milestone' }).click();
  form = page.getByTestId('milestone-form');
  await fillMilestone(form, { title: 'Bonus quiz', dueAt: '2026-12-10T12:00', weight: 1 });
  await form.getByRole('button', { name: 'Create milestone' }).click();
  await expect(page.getByRole('alert')).toHaveText('Total weight would be 101 % (max 100 %)');
  await page.screenshot({ path: `${shots}/F04-2-weight-exceeded.png`, fullPage: true });
  await form.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Bonus quiz')).toHaveCount(0);

  // 4. Edit M4's due date (FR-13); the new date is shown in Bangkok time
  const m4 = page.locator('li', { hasText: 'M4 Demo' });
  await m4.getByRole('button', { name: 'Edit' }).click();
  form = page.getByTestId('milestone-form');
  await form.getByLabel('Due date (Bangkok time)').fill('2026-12-11T09:30');
  await form.getByRole('button', { name: 'Save milestone' }).click();
  await expect(page.locator('li', { hasText: 'M4 Demo' })).toContainText('Due 11 Dec 2026, 09:30');
  await expect(page.getByTestId('total-weight')).toHaveText('Total weight: 100 / 100 %');
  await logout(page);

  // 5. A student of Team Alpha sees four milestones in due-date order, all "Not submitted" (FR-14)
  await login(page, 'student1@cpms.test');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await expect(page.getByTestId('total-weight')).toHaveText('Total weight: 100 / 100 % · Team: Team Alpha');
  const titles = page.locator('li strong');
  await expect(titles).toHaveText(['M1 Requirements', 'M2 Design', 'M4 Demo', 'M3 Final release']);
  await expect(page.getByTestId('team-status')).toHaveText(['Not submitted', 'Not submitted', 'Not submitted', 'Not submitted']);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await page.screenshot({ path: `${shots}/F04-3-student-list.png`, fullPage: true });
});
