# Sprint 1 UAT Cases — Course Project Management System (CPMS)

CPE334 Lab 6, Part A. These are the cases that the **UAT Team** (the partner team) runs on our deployed Sprint 1
release. The expected results come from the Sprint 1 contracts:
[`F-01-auth.md`](../sprints/sprint-1/F-01-auth.md) and [`F-02-proposal.md`](../sprints/sprint-1/F-02-proposal.md).
Read [`handoff.md`](handoff.md) first for the URL, version, accounts and data reset.

## Conventions

- **Manual UI test** unless a step says *API check*. You run an API check in the **same browser tab** where you
  are logged in, so the session cookie is sent. A `GET` goes in the address bar. A `POST` goes in the DevTools
  Console (F12) with the snippet given in the step.
- `<URL>` = the deployed URL in `handoff.md`.
- For every step, record what you **actually** see. Do not copy the expected result.
- Each case lists the evidence to capture. Name each screenshot with an evidence ID, for example `EV-B-UAT01-3`.
- Synthetic data only. The titles below start with `UAT` so that the data is easy to find and clean up.

## Coverage

| Case | Category (Lab 6 §3.1) | Sprint 1 AC covered | Requirements |
|---|---|---|---|
| UAT-01 | Normal domain journey | AC-02-01, AC-02-04, AC-02-05, AC-02-08, AC-02-13, AC-01-10 | FR-01, FR-05, FR-06, FR-07, FR-08, FR-09 |
| UAT-02 | Business rule / boundary (validation lengths) | AC-02-03, AC-02-09 (reason > 500) | FR-05, BR-04, NFR-06 |
| UAT-03 | Business rule (one active proposal, state machine) | AC-02-02, AC-02-07 | BR-01, BR-03, NFR-06 |
| UAT-04 | Forbidden ownership (other team's proposal) | AC-02-10, AC-02-12 | BR-05, NFR-02, NFR-03 |
| UAT-05 | Forbidden role (student acts as instructor) | AC-01-07, AC-02-11 | FR-04, NFR-03, R5 |
| UAT-06 | State / history / persistence | AC-02-09, AC-02-13, AC-02-14, AC-01-06 | FR-02, FR-08, FR-09, BR-01, BR-04 |
| UAT-07 | Authentication (no account enumeration, logout) | AC-01-02, AC-01-03, AC-01-05, AC-01-06 | FR-01, FR-02, NFR-02 |

**Sequence:** run the cases in this order: **UAT-07 → UAT-06 → UAT-02 → UAT-01 → UAT-03 → UAT-04 → UAT-05**.
UAT-06 rejects a proposal, which leaves Team Alpha free to create a new one for UAT-01. UAT-03, UAT-04 and
UAT-05 reuse the proposal that UAT-01 approves. If a case fails half-way, ask the Product Team to reset the data
(`handoff.md` §5) before you continue.

**Not tested on the deployed release** (they are covered by automated API tests, see `handoff.md` §7):
the deadline boundary (AC-02-05/06), a different instructor (AC-01-08 and part of AC-02-11), session expiry
(AC-01-05 expired session) and hash storage (AC-01-09).

---

## UAT-01 — Student creates and submits a proposal, instructor approves it

| Field | Value |
|---|---|
| Category | Normal domain journey |
| AC / Req | AC-02-01, AC-02-04, AC-02-05, AC-02-08, AC-02-13, AC-01-10 / FR-05–FR-09 |
| Purpose | Confirm the main Sprint 1 flow: a draft is created, edited and submitted by a team member, then approved by the course instructor, and the decision is shown to the team. |
| Roles / accounts | `STUDENT-A1` (Student One, Team Alpha), `INSTRUCTOR-1` (Instructor One) |
| Preconditions | Run UAT-06 first. Team Alpha has **no** DRAFT, SUBMITTED or APPROVED proposal. The course deadline (31 Dec 2026 23:59 Bangkok time) has not passed. |
| Inputs | Title `UAT-01 Smart Parking Finder`; description `Synthetic UAT proposal: mobile app that shows free parking slots.`; edited title `UAT-01 Smart Parking Finder v2` |

| # | Action | Expected result |
|---|---|---|
| 1 | Open `<URL>`, sign in as `STUDENT-A1`. | The header shows `Student One` with the badge `STUDENT`. "My courses" lists `CPE334`. |
| 2 | Click **My team proposal** for CPE334. | Heading `CPE334 — Team Alpha`, members `Student One, Student Two`, deadline shown. A **New proposal** form is shown. |
| 3 | Enter the title and description, then click **Create draft**. | The proposal appears with the badge `DRAFT` and an editable form. |
| 4 | Change the title to the edited title, then click **Save draft**. | The title now shows `UAT-01 Smart Parking Finder v2`, still `DRAFT`. |
| 5 | Click **Submit proposal**. | The badge becomes `SUBMITTED`, with the text "Submitted <date time> — waiting for the instructor's decision." The form is no longer editable. |
| 6 | Click **Log out**. Sign in as `INSTRUCTOR-1`. Click **Review proposals** for CPE334. | The list opens on the **Submitted** filter and shows Team Alpha's `UAT-01 Smart Parking Finder v2` with its submitted time. |
| 7 | Click **Approve**. | The proposal leaves the Submitted list. With the filter set to **Approved**, it shows `APPROVED`. |
| 8 | Log out. Sign in as `STUDENT-A1` and open **My team proposal**. | The proposal shows `APPROVED` and "Approved by Instructor One on <date time>". No New proposal form is shown. |

Evidence: screenshots after steps 3, 5, 6, 7 and 8.

---

## UAT-02 — Field length boundaries for title and reject reason

| Field | Value |
|---|---|
| Category | Business rule / boundary |
| AC / Req | AC-02-03, AC-02-09 / FR-05, BR-04, NFR-06 |
| Purpose | Confirm that the limits are enforced exactly at the boundary (title 120 characters, reason 500 characters) and that a rejected input changes nothing. |
| Roles / accounts | `STUDENT-A1`, `INSTRUCTOR-1` |
| Preconditions | Run after UAT-06. Team Alpha has no active proposal. |
| Inputs | **T120** = `UAT-02-` followed by 113 × `x` (120 characters). **T121** = T120 + `x` (121 characters). **R501** = 501 × `r`. Description `Synthetic boundary test.` Use the generator in the note below. |

| # | Action | Expected result |
|---|---|---|
| 1 | Sign in as `STUDENT-A1` → **My team proposal**. Enter **T121** as the title and the description, then click **Create draft**. | Error under Title: "At most 120 characters". No proposal is created; the page still says the team has no active proposal. |
| 2 | Clear the title and click **Create draft**. | Error under Title: "Title is required". No proposal is created. |
| 3 | Enter **T120** as the title and click **Create draft**. | The draft is created with the badge `DRAFT`. The title shows all 120 characters (it is not cut off). |
| 4 | Click **Submit proposal**. Log out. Sign in as `INSTRUCTOR-1` → **Review proposals** → **Reject**. Paste **R501** as the reason and click **Confirm reject**. | The rejection is refused with the error "At most 500 characters", and the counter shows `501/500`. With the filter set to **Submitted**, the proposal is still listed as `SUBMITTED`. |
| 5 | Replace the reason with 500 × `r` and click **Confirm reject**. | Accepted. The proposal now shows `REJECTED` under the **Rejected** filter. |

Note: to make the inputs, open the DevTools Console and run `'UAT-02-' + 'x'.repeat(113)` (T120),
`'UAT-02-' + 'x'.repeat(114)` (T121), `'r'.repeat(501)` (R501) or `'r'.repeat(500)`, then copy the result.
Evidence: screenshots after steps 1, 3, 4 (error and the proposal still SUBMITTED) and 5.

---

## UAT-03 — Only one active proposal; final states cannot change

| Field | Value |
|---|---|
| Category | Business rule (BR-01, BR-03) |
| AC / Req | AC-02-02, AC-02-07 / BR-01, BR-03, NFR-06 |
| Purpose | Confirm that a team cannot hold two active proposals and that an APPROVED proposal cannot be decided again. |
| Roles / accounts | `STUDENT-A1`, `INSTRUCTOR-1` |
| Preconditions | Run right after UAT-01: Team Alpha has an `APPROVED` proposal. Write down its id (step 1). |
| Inputs | Title `UAT-03 Second proposal`, description `Should be refused.` |

| # | Action | Expected result |
|---|---|---|
| 1 | Sign in as `STUDENT-A1`. *API check:* open `<URL>/api/courses` and note the CPE334 `id`. Open `<URL>/api/courses/<courseId>/my-team` and note `team.id` and the id of the APPROVED proposal. | JSON with `team.name` `Team Alpha` and one proposal with `"status":"APPROVED"`. |
| 2 | *API check (Console):* `fetch('/api/teams/<teamId>/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'UAT-03 Second proposal',description:'Should be refused.'})}).then(r=>r.json().then(b=>console.log(r.status,b)))` | `409` with `error.code` `ACTIVE_PROPOSAL_EXISTS`. |
| 3 | Reload **My team proposal**. | There is still only the APPROVED UAT-01 proposal. No `UAT-03 Second proposal` appears in the page or in its History. |
| 4 | Log out. Sign in as `INSTRUCTOR-1`. *API check (Console):* `fetch('/api/proposals/<proposalId>/reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reason:'UAT-03 try to change a final state'})}).then(r=>r.json().then(b=>console.log(r.status,b)))` | `409` with `error.code` `INVALID_TRANSITION`. |
| 5 | **Review proposals** → filter **Approved**. | The UAT-01 proposal is still `APPROVED`, with no reject reason. |

Evidence: Console output for steps 2 and 4, and screenshots for steps 3 and 5.

---

## UAT-04 — A student cannot read or change another team's proposal

| Field | Value |
|---|---|
| Category | Forbidden role / ownership |
| AC / Req | AC-02-10, AC-02-12 / BR-05, NFR-02, NFR-03 |
| Purpose | Confirm that ownership is enforced by the server, not only hidden in the UI, and that no data leaks on refusal. |
| Roles / accounts | `STUDENT-B1` (Student Three, Team Beta), `STUDENT-A1` |
| Preconditions | UAT-01 is done. You know Team Alpha's `teamId` and the UAT-01 `proposalId` (UAT-03 step 1). |
| Inputs | Title `UAT-04 Intrusion`, description `Should be refused.` |

| # | Action | Expected result |
|---|---|---|
| 1 | Sign in as `STUDENT-B1` → **My team proposal**. | Heading `CPE334 — Team Beta`. Nothing from Team Alpha is shown. |
| 2 | *API check:* open `<URL>/api/proposals/<Alpha proposalId>` in the address bar. | `{"error":{"code":"FORBIDDEN",...}}`. The response has **no** title, description or status of the Alpha proposal. |
| 3 | *API check (Console):* `fetch('/api/teams/<Alpha teamId>/proposals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'UAT-04 Intrusion',description:'Should be refused.'})}).then(r=>r.json().then(b=>console.log(r.status,b)))` | `403` `FORBIDDEN`. |
| 4 | Log out, then open `<URL>/api/proposals/<Alpha proposalId>` without signing in. | `401` `UNAUTHENTICATED`, no proposal data. |
| 5 | Sign in as `STUDENT-A1` → **My team proposal**. | Team Alpha's proposal and History are unchanged. No `UAT-04 Intrusion` exists. |

Evidence: screenshots for steps 2, 3 (Console), 4 and 5. Step 5 shows that the protected state did not change.

---

## UAT-05 — A student cannot use instructor functions

| Field | Value |
|---|---|
| Category | Forbidden role |
| AC / Req | AC-01-07, AC-02-11 / FR-04, NFR-03 |
| Purpose | Confirm that the roster, the review list and approve/reject are refused to students by the server, even though the UI hides the buttons. |
| Roles / accounts | `STUDENT-B1` (Student Three, Team Beta), `INSTRUCTOR-1` |
| Preconditions | Team Beta has a `SUBMITTED` proposal. Create it in step 1. |
| Inputs | Title `UAT-05 Beta proposal`, description `Synthetic proposal for the role test.` |

| # | Action | Expected result |
|---|---|---|
| 1 | Sign in as `STUDENT-B1` → **My team proposal**. Create a draft with the inputs, then submit it. Note its id from `<URL>/api/courses/<courseId>/my-team`. | The proposal shows `SUBMITTED`. |
| 2 | Go back to **My courses**. | Only **My team proposal** is shown. There is no **View roster** or **Review proposals** button. |
| 3 | *API check:* open `<URL>/api/courses/<courseId>/roster`. | `403` `FORBIDDEN`; no team or member names appear. |
| 4 | *API check:* open `<URL>/api/courses/<courseId>/proposals`. | `403` `FORBIDDEN`; no proposals appear. |
| 5 | *API check (Console):* `fetch('/api/proposals/<Beta proposalId>/approve',{method:'POST'}).then(r=>r.json().then(b=>console.log(r.status,b)))` | `403` `FORBIDDEN`. |
| 6 | Reload **My team proposal**. | The Beta proposal is still `SUBMITTED` (not APPROVED). |
| 7 | Log out. Sign in as `INSTRUCTOR-1` → **Review proposals** → **Submitted**. | `UAT-05 Beta proposal` is listed as `SUBMITTED`. Leave it there. |

Evidence: screenshots for steps 2, 3, 5 and 6.

---

## UAT-06 — A rejection and its reason persist; the team can try again

| Field | Value |
|---|---|
| Category | State / history / persistence |
| AC / Req | AC-02-09, AC-02-13, AC-02-14, AC-01-06 / FR-02, FR-08, FR-09, BR-01, BR-04 |
| Purpose | Confirm that a decision is stored on the server (it survives logout and a new login), that history is kept, and that a rejected team may create a new proposal. |
| Roles / accounts | `STUDENT-A1`, `STUDENT-A2` (Student Two, Team Alpha), `INSTRUCTOR-1` |
| Preconditions | Data reset done (`handoff.md` §5). Team Alpha has no active proposal. |
| Inputs | Title `UAT-06 Campus Lost and Found`, description `Synthetic proposal to be rejected.`, reason `UAT-06: scope too small, please add a matching feature.` |

| # | Action | Expected result |
|---|---|---|
| 1 | Sign in as `STUDENT-A1` → **My team proposal**. Create a draft with the inputs, then submit it. | The proposal shows `SUBMITTED`. |
| 2 | Log out. Sign in as `INSTRUCTOR-1` → **Review proposals** → **Reject**. Leave the reason blank and click **Confirm reject**. | The rejection is refused with the error "A reason is required". The proposal is still `SUBMITTED`. |
| 3 | Enter the reason and click **Confirm reject**. | Accepted. Under **Rejected**, the proposal shows `REJECTED`. |
| 4 | Log out. Close the browser tab. Open `<URL>` in a new tab and sign in as **`STUDENT-A2`** (a different member of the same team) → **My team proposal**. | The message reads: Your last proposal "UAT-06 Campus Lost and Found" was rejected: UAT-06: scope too small, please add a matching feature. History lists it as `REJECTED` with "Decided <date time> by Instructor One". |
| 5 | Reload the page (F5). | The same status, reason and history are shown. |
| 6 | Check that the **New proposal** form is shown. Do not create a proposal yet; UAT-02 and UAT-01 will use it. | The form is shown, because the team now has no active proposal (BR-01). |

Evidence: screenshots for steps 2, 3, 4 and 5.

---

## UAT-07 — Login errors do not reveal accounts; logout ends the session

| Field | Value |
|---|---|
| Category | Authentication / session state |
| AC / Req | AC-01-02, AC-01-03, AC-01-05, AC-01-06, AC-01-10 / FR-01, FR-02, NFR-02 |
| Purpose | Confirm that a wrong password and an unknown email give the same error, and that after logout the old session gives no data. |
| Roles / accounts | `STUDENT-A1` |
| Preconditions | None. |
| Inputs | Unknown email `nobody@cpms.test`; wrong password `WrongPass-123` |

| # | Action | Expected result |
|---|---|---|
| 1 | On the Sign in page, click Sign in with both fields empty. | The message "Please enter your email and password." is shown, and you stay on the Sign in page. |
| 2 | Sign in with the `STUDENT-A1` email and `WrongPass-123`. | An error banner appears. Write down the exact text. |
| 3 | Sign in with `nobody@cpms.test` and `WrongPass-123`. | **The same** error text as in step 2. |
| 4 | Sign in as `STUDENT-A1` with the correct password. Open `<URL>/api/auth/me` in the same tab. | JSON with `displayName` `Student One` and `role` `STUDENT`, and **no** `passwordHash`. |
| 5 | Return to the app and click **Log out**. Press the browser **Back** button, then open `<URL>/api/auth/me` again. | The Sign in page is shown. `/api/auth/me` returns `401` `UNAUTHENTICATED`. |

Evidence: screenshots for steps 2, 3, 4 and 5.

---

## Result recording template (for the UAT Team, Part B)

| Case | Step(s) | Tester (name / team) | Date-time (ICT) | Tested version (`/api/version`) | Inputs used | Actual result | PASS / FAIL / BLOCKED | Evidence ID |
|---|---|---|---|---|---|---|---|---|
| UAT-01 | 1–8 | | | | | | | |
