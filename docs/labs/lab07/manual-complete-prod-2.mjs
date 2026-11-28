// Lab 7 — screenshots for MT-1, MT-4, MT-5 on the deployed release with Playwright (run by Claude Code for Film26,
// 28 Nov 2026), because the manual screenshots of jaruwan18 for these steps were not supplied. Synthetic seed accounts;
// the password is read from the file named by PW_FILE and is never printed or saved.
// Usage: PW_FILE=<file outside the repo> node docs/labs/lab07/manual-complete-prod-2.mjs
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const URL = 'https://cpms-t4xsm3f7aa-as.a.run.app';
const out = 'docs/labs/lab07/evidence/manual';
const password = fs.readFileSync(process.env.PW_FILE, 'utf8').trim();
const log = [`# Lab 7 — MT-1, MT-4, MT-5 screenshots with Playwright on ${URL} (Chromium, headless, 1280×900)`];
const note = (s) => {
  const line = `${new Date().toISOString()}  ${s}`;
  log.push(line);
  console.log(line);
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const shot = async (name) => {
  await page.screenshot({ path: `${out}/${name}`, fullPage: true });
  note(`screenshot ${name}`);
};
async function login(email) {
  await page.goto(URL);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByTestId('current-user').waitFor();
  note(`signed in as ${email} (shown: "${await page.getByTestId('current-user').innerText()}")`);
}
async function logout() {
  await page.getByRole('button', { name: 'Log out' }).click();
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
}
const TITLE = 'Team Gamma - Lab 7 v2';
let ok = true;
try {
  note(`deployed version: ${await (await fetch(`${URL}/api/version`)).text()}`);
  // MT-1: the team's submitted proposal shows SUBMITTED and the Withdraw button
  await login('student5@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  const cur = page.getByTestId('current-proposal');
  await cur.getByTestId('status').filter({ hasText: 'SUBMITTED' }).waitFor();
  note(`student: "${await cur.locator('h3').innerText()}" status SUBMITTED, Withdraw buttons = ${await page.getByRole('button', { name: 'Withdraw submission' }).count()}`);
  await shot('L7-C7-MT1-submitted.png');
  await logout();

  // MT-4: reject with an empty reason is refused, status stays SUBMITTED
  await login('instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  await page.getByLabel('Status').selectOption('SUBMITTED');
  const row = page.locator('li', { hasText: TITLE }).first();
  await row.waitFor();
  await row.getByRole('button', { name: 'Reject' }).click();
  await row.getByRole('button', { name: 'Confirm reject' }).click();
  await row.getByText('A reason is required').waitFor();
  note(`instructor: Confirm reject with empty reason → "A reason is required"; row status = ${await row.getByTestId('status').innerText()}`);
  await shot('L7-C8-MT4-reject-needs-reason.png');

  // MT-5: reject with a reason → REJECTED, reason and decision shown
  await row.getByLabel('Reason for rejection').fill('Lab 7 MT-5 (automated run): please narrow the project scope.');
  await row.getByRole('button', { name: 'Confirm reject' }).click();
  await page.locator('li', { hasText: TITLE }).waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  await page.getByLabel('Status').selectOption('REJECTED');
  const rej = page.locator('li', { hasText: TITLE }).first();
  await rej.waitFor();
  note(`instructor (Rejected filter): "${TITLE}" status = ${await rej.getByTestId('status').innerText()}; text: ${(await rej.innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
  await shot('L7-C9-MT5-rejected-instructor.png');
  await logout();

  await login('student5@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await page.getByText('Lab 7 MT-5 (automated run)').first().waitFor();
  note('student: rejected proposal with the reason shown in History');
  await shot('L7-C9-MT5-rejected-student.png');
} catch (e) {
  ok = false;
  note(`STOPPED: ${e.message.split('\n')[0]}`);
  await shot('L7-C-error2.png').catch(() => {});
} finally {
  await browser.close();
}
log.push(ok ? 'RESULT: all steps passed' : 'RESULT: stopped, see above');
log.push(`# Data left on production: "${TITLE}" REJECTED (synthetic).`);
fs.writeFileSync(`${out}/claude-playwright-MT1-MT4-MT5.txt`, log.join('\n') + '\n');
process.exit(ok ? 0 : 1);
