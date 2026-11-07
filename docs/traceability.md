# Requirements Traceability
## Course Project Management System (CPMS)

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507216 (jaruwan18) · reviewed by 67070507202 (Film26) |
| Related | `docs/srs.md` (FR/BR/NFR text), `docs/features.md` (feature inventory), `docs/sprints/plan.md` (sprint goals), `docs/sprints/sprint-1/F-01-auth.md`, `docs/sprints/sprint-1/F-02-proposal.md` (AC and STS) |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | 67070507216 | First version: every FR/BR/NFR mapped to a feature or system responsibility, sprint, AC and test; coverage gaps and approved changes |

### How to read this document
- Every baseline requirement in `docs/srs.md` appears exactly once in §1–§3.
- **Sprint 1** rows name the real acceptance criteria (`AC-0x-yy`) and tests (`TEST-0x-yy`) from the Sprint 1 contracts. Every test ID is also in the test name in the file shown, so `npx vitest -t "TEST-02-08"` finds it.
- **Sprint 2–3** rows are *planned*: they have a feature and a sprint now. Their AC and tests are written in that sprint's contract (the deliverable does not require them yet).
- **Status**: *Verified (auto)* = automated test in `npm test` / `npm run test:e2e`; *Verified (manual)* = recorded manual check; *Partial* = part of the requirement is verified, the rest is planned (see §4); *Planned* = allocated, not built yet. Build/test output with the tested commit is in Deliverable Part F.

Test files: `server/tests/auth.unit.test.js` (A-U), `server/tests/auth.api.test.js` (A-API), `server/tests/proposal.unit.test.js` (P-U), `server/tests/proposal.api.test.js` (P-API), `server/tests/health.test.js` (H), `e2e/auth.spec.js` (A-E2E), `e2e/proposal.spec.js` (P-E2E).

## 1. Functional requirements

| Req | Summary | Feature | Sprint | AC | Tests (file) | Status |
|---|---|---|---|---|---|---|
| FR-01 | Log in with e-mail + password, get a session | F-01 Auth & roster | S1 | AC-01-01, AC-01-02, AC-01-03, AC-01-10 | TEST-01-04, TEST-01-05, TEST-01-06 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-02 | Log out; the session cannot be reused | F-01 | S1 | AC-01-06, AC-01-10 | TEST-01-10 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-03 | Current user + role from the session only | F-01 | S1 | AC-01-04, AC-01-11 | TEST-01-07, TEST-01-14 (A-API) | Verified (auto) |
| FR-04 | Instructor views roster of own course | F-01 | S1 | AC-01-08, AC-01-10 | TEST-01-12 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-05 | Student creates / edits a draft proposal for own team | F-02 Proposal workflow | S1 | AC-02-01, AC-02-03, AC-02-04, AC-02-14 | TEST-02-04 (P-U); TEST-02-05, TEST-02-09, TEST-02-10 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-06 | Student submits draft → `SUBMITTED`, time recorded | F-02 | S1 (revised S2, see C-02) | AC-02-05, AC-02-14 | TEST-02-02 (P-U); TEST-02-11 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-07 | Instructor lists course proposals by status | F-02 | S1 | AC-02-13, AC-02-14 | TEST-02-19 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-08 | Instructor approves / rejects with reason; decider + time recorded | F-02 | S1 | AC-02-08, AC-02-09, AC-02-14 | TEST-02-14, TEST-02-15 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-09 | Team members view proposal, status, decision/reason | F-02 | S1 | AC-02-13, AC-02-14 | TEST-02-19 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-10 | Student creates a team, gets a join code | F-03 Team formation | S2 | planned in F-03 contract | planned | Planned |
| FR-11 | Student joins a team by join code | F-03 | S2 | planned | planned | Planned |
| FR-12 | Student leaves team while no approved proposal | F-03 | S2 | planned | planned | Planned |
| FR-13 | Instructor manages milestones | F-04 Milestones | S2 | planned | planned | Planned |
| FR-14 | Students view milestones + own submission status | F-04 | S2 | planned | planned | Planned |
| FR-15 | Team member submits deliverable URL + note | F-05 Submissions | S2 | planned | planned | Planned |
| FR-16 | Resubmit before due date; history kept | F-05 | S2 | planned | planned | Planned |
| FR-17 | Instructor grades and releases | F-06 Grading | S2 | planned | planned | Planned |
| FR-18 | Team views released grades of own team only | F-06 | S2 | planned | planned | Planned |
| FR-19 | Student rates each teammate once per milestone | F-07 Peer evaluation | S3 | planned | planned | Planned |
| FR-20 | Instructor views average peer ratings | F-07 | S3 | planned | planned | Planned |
| FR-21 | Instructor course dashboard | F-08 Dashboard | S3 | planned | planned | Planned |
| FR-22 | Audit entries for decisions, grade releases, membership changes | F-09 Audit log | S3 | planned | planned | Planned (see G-03) |

## 2. Business rules

| Req | Summary | Feature | Sprint | AC | Tests (file) | Status |
|---|---|---|---|---|---|---|
| BR-01 | One active proposal per team; new one only after `REJECTED` | F-02 | S1 | AC-02-02 | TEST-02-03 (P-U); TEST-02-06, TEST-02-07, TEST-02-08 concurrency (P-API) | Verified (auto); see G-01 |
| BR-02 | No submit after `proposalDeadline` (server time) | F-02 | S1 | AC-02-05, AC-02-06 | TEST-02-02 boundary (P-U); TEST-02-11, TEST-02-12 (P-API) | Verified (auto) |
| BR-03 | Only `DRAFT→SUBMITTED`, `SUBMITTED→APPROVED/REJECTED`; final states | F-02 | S1 | AC-02-04, AC-02-07 | TEST-02-01 all 16 pairs (P-U); TEST-02-10, TEST-02-13 (P-API) | Verified (auto) |
| BR-04 | Reject reason required, ≤ 500 chars | F-02 | S1 | AC-02-09 | TEST-02-04 500/501 boundary (P-U); TEST-02-15 (P-API) | Verified (auto) |
| BR-05 | Only team members act on / read own proposal; only course instructor decides | F-02 | S1 | AC-02-10, AC-02-11 | TEST-02-16, TEST-02-17 (P-API); TEST-02-20 other-team 403 (P-E2E) | Verified (auto) |
| BR-06 | One team per student per course | F-03 | S2 | planned | planned | Planned |
| BR-07 | Team size min/max; submit only with ≥ `minTeamSize` members | F-03 (+ change to F-02 submit) | S2 | planned | planned | Planned (see C-02) |
| BR-08 | Membership locked after proposal `APPROVED` | F-03 | S2 | planned | planned | Planned |
| BR-09 | Milestone weights ≤ 100 % | F-04 | S2 | planned | planned | Planned |
| BR-10 | Only teams with `APPROVED` proposal submit deliverables | F-05 (depends on F-02) | S2 | planned | planned | Planned |
| BR-11 | Late submissions marked `LATE`; resubmission rule | F-05 | S2 | planned | planned | Planned (see G-05) |
| BR-12 | Score within 0..max score; visible only after release | F-06 | S2 | planned | planned | Planned (see G-04) |
| BR-13 | No self-rating; once per teammate per milestone; individual ratings hidden | F-07 | S3 | planned | planned | Planned |

F-01 has no business rule of its own. Its internal rules R1–R6 (identical login error, session-only identity, etc.) are recorded in `F-01-auth.md` and trace to FR-01–04 and NFR-01–04 above and below.

## 3. Non-functional requirements (cross-cutting)

NFRs are system responsibilities, so one NFR can link to several features. *Established* = the sprint where the mechanism is built; *Verified* = the sprint(s) where its check runs.

| Req | Summary | Responsibility / features | Established | Verified | Sprint 1 evidence (AC → tests, file) | Status |
|---|---|---|---|---|---|---|
| NFR-01 | bcrypt hashes only; no password / token hash in any response | F-01 (`auth/password.js`, `auth/session.js`) | S1 | S1 | AC-01-01, AC-01-09 → TEST-01-02, TEST-01-03 (A-U); TEST-01-04, TEST-01-12 (A-API) | Verified (auto) |
| NFR-02 | Unauthenticated → 401, no private data | `requireAuth` middleware; every feature | S1 | S1, re-checked each sprint | AC-01-05 → TEST-01-08, TEST-01-09 (A-API); AC-02-12 → TEST-02-18 (P-API) | Verified (auto) for F-01, F-02 |
| NFR-03 | Role + ownership enforced in backend, 403, no private data | `requireRole` + ownership checks in services; every feature | S1 | every sprint | AC-01-07, AC-01-08 → TEST-01-11, TEST-01-12; AC-02-10, AC-02-11 → TEST-02-16, TEST-02-17; UI 403 → TEST-01-13, TEST-02-20 | Verified (auto) for F-01, F-02 |
| NFR-04 | Session expiry (8 h) and revocation on logout | F-01 (`auth/session.js`) | S1 | S1 | AC-01-05, AC-01-06 → TEST-01-01 boundary (A-U); TEST-01-09, TEST-01-10 (A-API) | Verified (auto) |
| NFR-05 | One error shape; 5xx without stack/SQL | `errors.js`; every route | S1 | S2 | 400/401/403/404/409 shapes asserted in A-API and P-API; unknown route → H "unknown API route returns the standard error shape" | Partial — forced-500 test planned S2 (G-02) |
| NFR-06 | Rules + DB constraints; no partial data on rejection | services + Prisma schema; every feature | S1 | every sprint | DB state checked after negative tests: TEST-02-06, TEST-02-08, TEST-02-09, TEST-02-12, TEST-02-13, TEST-02-15, TEST-02-16, TEST-02-17; TEST-01-05 (no session row) | Verified (auto) for S1; see G-01 |
| NFR-07 | Clone → `.env` → migrate → seed → test in ≤ 15 min from README | README; whole repo | S1 | S1, S3 | Manual: teammate follows README on a clean machine, time recorded in the release PR | Planned S1 manual check (G-06) |
| NFR-08 | Config via env vars; no secrets in Git/client; single Docker container | `config.js`, `.env.example`; deployment (Lab 5) | S1 design | Lab 5 (S2) | `.env` and `.env.test` git-ignored; `.env.example` has placeholders only | Partial — secret scan + Docker build in Lab 5 |
| NFR-09 | Loading / empty / error states; field validation messages | client pages; every feature with UI | S1 | every sprint | TEST-01-13 (invalid login error), TEST-02-20 (A-E2E, P-E2E); screenshots `F01-1-invalid-login.png`, `F02-1-student-validation.png` | Partial — UI review checklist per sprint (G-07) |
| NFR-10 | List endpoints p95 < 500 ms at 50 teams × 3 students | roster, proposal list, dashboard | S3 | S3 | — | Planned |
| NFR-11 | ≥ 80 % line coverage of domain-rule modules; every AC verified | test suite; every feature | S2 | S2, S3 | Every Sprint 1 AC (AC-01-01…11, AC-02-01…14) has ≥ 1 test above; coverage tool not configured yet | Partial — `vitest --coverage` from S2 |

### 3.1 Sprint 1 AC coverage check
Every Sprint 1 acceptance criterion maps to at least one test:

| AC | Tests | AC | Tests |
|---|---|---|---|
| AC-01-01 | TEST-01-04 | AC-02-01 | TEST-02-05 |
| AC-01-02 | TEST-01-05, TEST-01-13 | AC-02-02 | TEST-02-03, 02-06, 02-07, 02-08 |
| AC-01-03 | TEST-01-06 | AC-02-03 | TEST-02-04, 02-09 |
| AC-01-04 | TEST-01-07 | AC-02-04 | TEST-02-10 |
| AC-01-05 | TEST-01-01, 01-08, 01-09 | AC-02-05 | TEST-02-02, 02-11 |
| AC-01-06 | TEST-01-10 | AC-02-06 | TEST-02-02, 02-12 |
| AC-01-07 | TEST-01-11 | AC-02-07 | TEST-02-01, 02-13 |
| AC-01-08 | TEST-01-12 | AC-02-08 | TEST-02-14 |
| AC-01-09 | TEST-01-02, 01-03, 01-04 | AC-02-09 | TEST-02-04, 02-15 |
| AC-01-10 | TEST-01-13 | AC-02-10 | TEST-02-16, 02-20 |
| AC-01-11 | TEST-01-14 | AC-02-11 | TEST-02-17 |
| | | AC-02-12 | TEST-02-18 |
| | | AC-02-13 | TEST-02-19 |
| | | AC-02-14 | TEST-02-20 |

## 4. Coverage gaps

Requirements, or parts of them, that are not fully verified at the end of Sprint 1. Each one has an owner sprint.

| ID | Requirement | Gap | Plan |
|---|---|---|---|
| G-01 | BR-01, NFR-06 | BR-01 is enforced by a transaction with a team row lock (`SELECT … FOR UPDATE`), **not** by a DB constraint. A partial unique index (`WHERE status <> 'REJECTED'`) cannot be expressed in the Prisma schema. | Accepted limitation (F-02 §4, §9). TEST-02-08 proves 5 concurrent creates give exactly one row. Revisit if Prisma supports partial indexes. |
| G-02 | NFR-05 | No test forces an unexpected error to prove a 500 response hides stack traces and SQL. | Add forced-error API test in S2. |
| G-03 | FR-22 | F-02 decisions (approve/reject) are not written to an audit log yet; `decidedAt`, `decidedById` and `rejectReason` on `Proposal` are the Sprint 1 record. | F-09 in S3 adds `AuditLog` entries for proposal decisions. |
| G-04 | FR-13, BR-12 | BR-12 refers to a milestone's maximum score, but FR-13 lists only title, description, due date and weight. | Add max score to FR-13 when the F-04 contract is written (S2). |
| G-05 | BR-11 | Wording does not say whether a team whose first submission was already late may resubmit late. | Resolve in the F-05 contract (S2) and record in SRS §9. |
| G-06 | NFR-07 | Clean-machine README run (≤ 15 min) not yet recorded. | Teammate runs it before the Sprint 1 release PR into `main`; time and commit recorded in that PR. |
| G-07 | NFR-09 | Empty/loading states are implemented on all Sprint 1 screens but only error/validation states are covered by E2E tests. | UI review checklist recorded per sprint from S2. |
| G-08 | Sprint 1 scope | SRS Q-05 is open: the Sprint 1 slice is not yet confirmed against the theme's Sprint 1 example in `group_work_specs.docx`. | Team confirms before the release to `main`; resolution recorded in SRS §9. |

## 5. Approved changes

Changes to requirements, contracts or tests after their first version. Each one is visible in the version history of the named document.

| ID | Date | Document / version | Change | Reason | Approved by |
|---|---|---|---|---|---|
| C-01 | 2026-11-07 | F-01 contract v1.1 | Added `GET /api/courses`, AC-01-11, TEST-01-14 | Home page needs the user's courses; scoped by session user, no new data | jaruwan18 (PR #3 review) |
| C-02 | 2026-11-07 (planned for S2) | F-02 contract (next version) | FR-06 submit will also check BR-07 (team has ≥ `minTeamSize` members); BR-08 locks membership after approval | BR-07/BR-08 belong to F-03, which arrives in S2; Sprint 1 teams are seeded (SRS A-02) | To be approved in the F-03 PR |
| C-03 | 2026-11-07 | F-02 contract v1.1 | Role check (403) runs before input validation (400); review list opens on "Submitted" | Reuses F-01 `requireRole`; no AC or test changed | Film26 (PR #6 review) |
| C-04 | 2026-11-07 | F-02 contract v1.2 | E2E tests run on a separate `cpms_e2e` database; TEST-02-20 precondition updated | PR #6 review found E2E cleanup could delete `cpms_dev` data | Film26 (PR #6 review) |
| C-05 | 2026-11-07 | System SDS v0.2 | Role/permission matrix names the real F-02 endpoints and adds `GET /api/courses/:courseId/my-team`; §2.2 records how BR-01 is enforced | PR #4 review by jaruwan18 | jaruwan18 (PR #4 review) |
