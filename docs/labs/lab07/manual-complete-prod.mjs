// Lab 7 — complete the manual checks MT-2, MT-3, MT-6 on the deployed release with Playwright (run by Claude Code for
// Film26, 28 Nov 2026). Uses the synthetic seed accounts; the password is read from the file named by PW_FILE and is
// never printed or saved. Screenshots and a timestamped log go to docs/labs/lab07/evidence/manual/.
// Usage: PW_FILE=<file outside the repo> node docs/labs/lab07/manual-complete-prod.mjs
import fs from 'node:fs';
import { chromium } from '@playwright/test';

const URL = 'https://cpms-t4xsm3f7aa-as.a.run.app';
const out = 'docs/labs/lab07/evidence/manual';
const password = fs.readFileSync(process.env.PW_FILE, 'utf8').trim();
const log = [`# Lab 7 — MT-2, MT-3, MT-6 completed with Playwright on ${URL} (Chromium, headless, 1280×900)`];
const note = (s) => {
  const line = `${new Date().toISOString()}  ${s}`;
  log.push(line);
  console.log(line);
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('dialog', (d) => {
  note(`confirm dialog: "${d.message()}" → OK`);
  d.accept();
});
const status = () => page.getByTestId('current-proposal').getByTestId('status');
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
const expectStatus = async (want) => {
  await page.waitForFunction(
    (w) => document.querySelector('[data-testid="current-proposal"] [data-testid="status"]')?.textContent === w,
    want,
    { timeout: 15000 },
  );
  note(`status = ${want}`);
};

let ok = true;
try {
  // MT-1 (setup again): Team Gamma submits a new proposal (its earlier one is REJECTED, so a new one is allowed, BR-01)
  await login('student5@cpms.test');
  await page.getByRole('button', { name: 'My team proposal' }).click();
  await page.getByLabel('Title').fill('Team Gamma - Lab 7');
  await page.getByLabel('Description').fill('Synthetic proposal for the Lab 7 manual check (withdraw, edit, submit again).');
  await page.getByRole('button', { name: 'Create draft' }).click();
  await expectStatus('DRAFT');
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  await expectStatus('SUBMITTED');
  await shot('L7-C1-submitted.png');

  // MT-2: withdraw → DRAFT
  await page.getByRole('button', { name: 'Withdraw submission' }).click();
  await expectStatus('DRAFT');
  note(`Withdraw button count after withdraw: ${await page.getByRole('button', { name: 'Withdraw submission' }).count()}`);
  await shot('L7-C2-withdrawn-draft.png');

  // MT-3: edit the title, submit again, the new title is shown (student and instructor)
  await page.getByLabel('Title').fill('Team Gamma - Lab 7 v2');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByRole('button', { name: 'Submit proposal' }).click();
  await expectStatus('SUBMITTED');
  note(`student sees title: "${await page.getByTestId('current-proposal').locator('h3').innerText()}"`);
  await shot('L7-C3-resubmitted-v2-student.png');
  await logout();

  await login('instructor1@cpms.test');
  await page.getByRole('button', { name: 'Review proposals' }).click();
  await page.getByLabel('Status').selectOption('SUBMITTED');
  const v2 = page.locator('li', { hasText: 'Team Gamma - Lab 7 v2' });
  await v2.first().waitFor();
  note(`instructor (Submitted filter): "Team Gamma - Lab 7 v2" rows = ${await v2.count()}, status = ${await v2.first().getByTestId('status').innerText()}`);
  await shot('L7-C3-resubmitted-v2-instructor.png');

  // MT-6: the Team Beta proposal approved by jaruwan18 on 28 Nov is APPROVED (view only, nothing changed)
  await page.getByLabel('Status').selectOption('APPROVED');
  const beta = page.locator('li', { hasText: 'Team Beta - Lab 7 Manual Test' });
  await beta.first().waitFor();
  note(`instructor (Approved filter): "Team Beta - Lab 7 Manual Test" status = ${await beta.first().getByTestId('status').innerText()}`);
  await shot('L7-C6-approved.png');
} catch (e) {
  ok = false;
  note(`STOPPED: ${e.message.split('\n')[0]}`);
  await shot('L7-C-error.png').catch(() => {});
} finally {
  await browser.close();
}
log.push(ok ? 'RESULT: all steps passed' : 'RESULT: stopped, see above');
log.push('# Data left on production: Team Gamma proposal "Team Gamma - Lab 7 v2" SUBMITTED (synthetic).');
fs.writeFileSync(`${out}/claude-playwright-MT2-MT3-MT6.txt`, log.join('\n') + '\n');
process.exit(ok ? 0 : 1);
