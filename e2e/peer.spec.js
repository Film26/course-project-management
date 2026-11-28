// TEST-07-10 (AC-07-09) — UI end-to-end journey for F-07 Peer Evaluation.
// Runs against the separate E2E database (server/.env.e2e → cpms_e2e), never cpms_dev. Setup: Team Alpha =
// student1 + student2, milestone "M1 Requirements" exists, and earlier peer ratings of the course are cleared.
import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { SEED_PASSWORD, DATABASE_URL, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-3/evidence/screenshots';
let student2Id;

test.beforeAll(async () => {
  assertE2eDatabase(); // refuses to delete anything unless the database name contains "e2e"
  const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });
  try {
    const course = await prisma.course.findUniqueOrThrow({ where: { code: 'CPE334' } });
    const alpha = await prisma.team.findFirstOrThrow({ where: { courseId: course.id, name: 'Team Alpha' } });
    for (const email of ['student1@cpms.test', 'student2@cpms.test']) {
      const u = await prisma.user.findUniqueOrThrow({ where: { email } });
      if (email === 'student2@cpms.test') student2Id = u.id;
      await prisma.enrollment.upsert({ where: { courseId_userId: { courseId: course.id, userId: u.id } }, update: {}, create: { courseId: course.id, userId: u.id } });
      await prisma.teamMember.upsert({
        where: { courseId_userId: { courseId: course.id, userId: u.id } },
        update: { teamId: alpha.id },
        create: { teamId: alpha.id, userId: u.id, courseId: course.id },
      });
    }
    await prisma.peerRating.deleteMany({ where: { milestone: { courseId: course.id } } });
    const m1 = await prisma.milestone.findFirst({ where: { courseId: course.id, title: 'M1 Requirements' } });
    if (!m1) await prisma.milestone.create({ data: { courseId: course.id, title: 'M1 Requirements', dueAt: new Date(Date.now() + 7 * 86400000), weight: 20, maxScore: 100 } });
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

test('TEST-07-10 student1 rates student2 (4) for M1 once; instructor1 sees the average 4.00 (1 rating)', async ({ page }) => {
  // 1. student1 opens M1 → Rate teammates; only the teammate (not themselves) is listed (BR-13)
  await login(page, 'student1@cpms.test');
  await page.getByRole('button', { name: 'Milestones' }).click();
  await page.locator('li', { hasText: 'M1 Requirements' }).getByRole('button', { name: 'Rate teammates' }).click();
  await expect(page.getByRole('heading', { name: /Rate teammates — M1 Requirements/ })).toBeVisible();
  const card = page.getByTestId(`peer-${student2Id}`);
  await expect(card).toContainText('Student Two');
  await expect(page.getByTestId('peer-teammates')).not.toContainText('Student One');

  // 2. Submitting without a score is stopped by the form; then 4 with a comment is stored (FR-19)
  await card.getByRole('button', { name: 'Submit rating' }).click();
  await expect(card.getByText('Choose a score from 1 to 5')).toBeVisible();
  await card.getByLabel('Score for Student Two').selectOption('4');
  await card.getByLabel('Comment for Student Two').fill('Wrote most of the API tests');
  await card.getByRole('button', { name: 'Submit rating' }).click();
  await expect(card.getByTestId('rated')).toHaveText('Rated: 4');
  await expect(card.getByRole('button', { name: 'Submit rating' })).toHaveCount(0); // once per milestone
  await page.screenshot({ path: `${shots}/F07-1-student-rated.png`, fullPage: true });
  await logout(page);

  // 3. instructor1 opens Peer ratings: student2 average 4.00 from 1 rating, comment without the rater's name (FR-20)
  await login(page, 'instructor1@cpms.test');
  await page.getByRole('button', { name: 'Peer ratings' }).click();
  const row = page.getByTestId(`peer-row-${student2Id}`);
  await expect(row.getByTestId('average')).toHaveText('4.00');
  await expect(row.getByTestId('count')).toHaveText('1');
  await row.getByText('1 comment(s)').click();
  await expect(row).toContainText('Wrote most of the API tests');
  await page.screenshot({ path: `${shots}/F07-2-instructor-summary.png`, fullPage: true });
});
