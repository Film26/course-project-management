// TEST-01-13 (AC-01-10, AC-01-02, AC-01-07) — UI end-to-end journey for F-01.
// Uses the seeded synthetic accounts in the E2E database; the password is read from server/.env.e2e (never hard-coded).
import { test, expect } from '@playwright/test';
import { SEED_PASSWORD, assertE2eDatabase } from './e2eEnv.js';

const shots = 'docs/sprints/sprint-1/evidence/screenshots';

test.beforeAll(assertE2eDatabase);

async function fillLogin(page, email, password) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('TEST-01-13 instructor: invalid login → login → roster → logout', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  // AC-01-02: wrong password shows an error and stays on the login page
  await fillLogin(page, 'instructor1@cpms.test', 'wrong-password');
  await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect');
  await page.screenshot({ path: `${shots}/F01-1-invalid-login.png` });

  // AC-01-10: valid login shows identity and role from the server
  await fillLogin(page, 'instructor1@cpms.test', SEED_PASSWORD);
  await expect(page.getByTestId('current-user')).toContainText('Instructor One');
  await expect(page.getByTestId('current-user')).toContainText('INSTRUCTOR');
  await page.screenshot({ path: `${shots}/F01-2-instructor-home.png` });

  // Instructor-only roster of the course they teach
  await page.getByRole('button', { name: 'View roster' }).click();
  await expect(page.getByRole('heading', { name: 'Team Alpha' })).toBeVisible();
  await expect(page.getByText('Student One')).toBeVisible();
  await page.screenshot({ path: `${shots}/F01-3-roster.png` });

  // Logout returns to the login page, and a reload does not restore the session
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await page.screenshot({ path: `${shots}/F01-4-after-logout.png` });
});

test('TEST-01-13b student: no roster button, and the API itself forbids the roster (AC-01-07)', async ({ page }) => {
  await page.goto('/');
  await fillLogin(page, 'student1@cpms.test', SEED_PASSWORD);
  await expect(page.getByTestId('current-user')).toContainText('STUDENT');
  await expect(page.getByRole('button', { name: 'View roster' })).toHaveCount(0);

  // Hidden button is not the protection: call the API directly with the student's own session cookie.
  const { courses } = await (await page.request.get('/api/courses')).json();
  const res = await page.request.get(`/api/courses/${courses[0].id}/roster`);
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error.code).toBe('FORBIDDEN');
  expect(body.teams).toBeUndefined();

  // Show the forbidden API response in the browser for the Part F screenshot
  await page.goto(`/api/courses/${courses[0].id}/roster`);
  await expect(page.locator('body')).toContainText('FORBIDDEN');
  await page.screenshot({ path: `${shots}/F01-5-student-roster-403.png` });
});
