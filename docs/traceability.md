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
| 0.2 | 2026-11-07 | 67070507216 | Aligned with `features.md` v0.1 (PR #8): NFR rows name system responsibilities SR-01–SR-04; G-01 plan moved to S3 hardening as in `plan.md` |
| 0.3 | 2026-11-07 | 67070507216 | PR #9 review by Film26: FR-06 status split into the Sprint 1 scope (verified) and the BR-07 minimum-team-size check (planned S2); NFR-07 status states that the README run has not been done yet |
| 0.4 | 2026-11-09 | 67070507216 | NFR-07 / G-06: README run recorded on PR #10 (2026-11-09, `bb734b0`): all steps and tests passed, 21 min 36 s, target not met; fix planned in S2. C-06 records PR #10. PR #13 review by Film26: NFR-07 Verified column shows the S2 rerun; G-06 says the two setup failures came from an earlier attempt on `a32fbe4`; G-08 records how Q-05 was closed (PR #14) |
| 0.5 | 2026-11-25 | 67070507202 | Sprint 2/3 rows filled from the F-03 … F-09 contracts with real AC and TEST IDs and honest status (implemented on PR / RED / contract only); new §3.2 per-AC status table; status legend extended. Baseline revisions C-07 … C-15 and D-08 are listed in `docs/deliverable2/change-register.md` §3. Drafted with an AI assistant (Claude Code) |
| 0.6 | 2026-11-25 | 67070507202 | PR #53 review by 67070507216: statuses refreshed to the real PRs and CI runs (F-03 #56, F-05 #57, F-06 #47, F-07 #54, F-09 #52, F-04 and F-08 merged); §3.2 regenerated from the current contract versions (69 ACs, incl. AC-06-10; AC-07-04 and AC-08-03 now show their tests) |

### How to read this document
- Every baseline requirement in `docs/srs.md` appears exactly once in §1–§3.
- **Sprint 1** rows name the real acceptance criteria (`AC-0x-yy`) and tests (`TEST-0x-yy`) from the Sprint 1 contracts. Every test ID is also in the test name in the file shown, so `npx vitest -t "TEST-02-08"` finds it.
- **Sprint 2–3** rows are *planned*: they have a feature and a sprint now. Their AC and tests are written in that sprint's contract (the deliverable does not require them yet).
- **Status**: *Verified (auto)* = automated test in `npm test` / `npm run test:e2e`; *Verified (manual)* = recorded manual check; *Partial* = the Sprint 1 part of the requirement is verified, the rest is planned (the row says which part); *Implemented, passing on PR #n* = code and tests exist on a reviewed feature branch and the tests ran and passed there, but the PR is not merged into a release yet; *In progress: tests written (RED)* = tests committed before the code and failing as expected; *Contract only* = AC and STS written, no test run yet; *Planned* = allocated, not built yet. Build/test output with the tested commit is in Deliverable Part F.

Sprint 2/3 test files in `server/tests/`: `team.*` (T-U / T-API, F-03), `milestone.*` (M-U / M-API, F-04), `submission.*` (S-U / S-API, F-05), `grade.*` (G-U / G-API, F-06), `audit.*` (L-U / L-API, F-09); E2E in `e2e/`.

Test files: `server/tests/auth.unit.test.js` (A-U), `server/tests/auth.api.test.js` (A-API), `server/tests/proposal.unit.test.js` (P-U), `server/tests/proposal.api.test.js` (P-API), `server/tests/health.test.js` (H), `e2e/auth.spec.js` (A-E2E), `e2e/proposal.spec.js` (P-E2E).

## 1. Functional requirements

| Req | Summary | Feature | Sprint | AC | Tests (file) | Status |
|---|---|---|---|---|---|---|
| FR-01 | Log in with e-mail + password, get a session | F-01 Auth & roster | S1 | AC-01-01, AC-01-02, AC-01-03, AC-01-10 | TEST-01-04, TEST-01-05, TEST-01-06 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-02 | Log out; the session cannot be reused | F-01 | S1 | AC-01-06, AC-01-10 | TEST-01-10 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-03 | Current user + role from the session only | F-01 | S1 | AC-01-04, AC-01-11 | TEST-01-07, TEST-01-14 (A-API) | Verified (auto) |
| FR-04 | Instructor views roster of own course | F-01 | S1 | AC-01-08, AC-01-10 | TEST-01-12 (A-API); TEST-01-13 (A-E2E) | Verified (auto) |
| FR-05 | Student creates / edits a draft proposal for own team | F-02 Proposal workflow | S1 | AC-02-01, AC-02-03, AC-02-04, AC-02-14 | TEST-02-04 (P-U); TEST-02-05, TEST-02-09, TEST-02-10 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-06 | Student submits draft → `SUBMITTED`, time recorded | F-02 | S1 (revised S2, see C-02) | AC-02-05, AC-02-14 | TEST-02-02 (P-U); TEST-02-11 (P-API); TEST-02-20 (P-E2E) | Partial — Sprint 1 scope Verified (auto): submit, status change, `submittedAt`, deadline (BR-02). Minimum team size before submit (BR-07) Planned S2 with F-03 |
| FR-07 | Instructor lists course proposals by status | F-02 | S1 | AC-02-13, AC-02-14 | TEST-02-19 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-08 | Instructor approves / rejects with reason; decider + time recorded | F-02 | S1 | AC-02-08, AC-02-09, AC-02-14 | TEST-02-14, TEST-02-15 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-09 | Team members view proposal, status, decision/reason | F-02 | S1 | AC-02-13, AC-02-14 | TEST-02-19 (P-API); TEST-02-20 (P-E2E) | Verified (auto) |
| FR-10 | Student creates a team, gets a join code | F-03 Team formation | S2 | AC-03-01, AC-03-02, AC-03-12, AC-03-13 | TEST-03-01 (T-U); TEST-03-02, TEST-03-05, TEST-03-06, TEST-03-16 (T-API); TEST-03-17 (E2E) | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending |
| FR-11 | Student joins a team by join code | F-03 | S2 | AC-03-03, AC-03-06 | TEST-03-01 (T-U); TEST-03-07, TEST-03-10 (T-API) | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending |
| FR-12 | Student leaves team while no approved proposal | F-03 | S2 | AC-03-07 | TEST-03-11 (T-API); TEST-03-17 (E2E) | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending |
| FR-13 | Instructor manages milestones (incl. max score, C-08) | F-04 Milestones | S2 | AC-04-01, AC-04-02, AC-04-04, AC-04-05, AC-04-09 | TEST-04-01 (M-U); TEST-04-03, TEST-04-04, TEST-04-07, TEST-04-08 (M-API); TEST-04-12 (E2E) | Implemented, passing on PR #48 (`278de51`, CI run 45555374710); not yet integrated |
| FR-14 | Students view milestones + own submission status | F-04 (list), F-05 (status) | S2 | AC-04-06, AC-05-07 | TEST-04-09, TEST-04-09b after F-03 (M-API); TEST-05-04 (S-U), TEST-05-11 (S-API) | List verified (PR #48, merged); `SUBMITTED` / `LATE` implemented on PR #57, tests pass |
| FR-15 | Team member submits deliverable URL + note | F-05 Submissions | S2 | AC-05-01, AC-05-02, AC-05-11 | TEST-05-01 (S-U); TEST-05-05, TEST-05-06 (S-API); TEST-05-15 (E2E) | Implemented, tests pass on PR #57 (CI run 45653196163); merge pending |
| FR-16 | Resubmit before due date; history kept | F-05 | S2 | AC-05-04, AC-05-07 | TEST-05-02, TEST-05-04 (S-U); TEST-05-08, TEST-05-11 (S-API) | Implemented, tests pass on PR #57 (CI run 45653196163); merge pending |
| FR-17 | Instructor grades and releases | F-06 Grading | S2 | AC-06-01, AC-06-03, AC-06-04 | TEST-06-02 (G-U); TEST-06-04, TEST-06-06, TEST-06-07 (G-API) | Implemented, tests pass on PR #47 (CI run 45638396394); merge pending |
| FR-18 | Team views released grades of own team only | F-06 | S2 | AC-06-05, AC-06-07 | TEST-06-03 (G-U); TEST-06-08, TEST-06-10 (G-API); TEST-06-12 (E2E) | Implemented, tests pass on PR #47 (CI run 45638396394); merge pending |
| FR-19 | Student rates each teammate once per milestone | F-07 Peer evaluation | S3 | AC-07-01, AC-07-02, AC-07-09 | TEST-07-01, TEST-07-03, TEST-07-04, TEST-07-10 | Contract only (PR #54, owner 67070507202 since plan v0.4) |
| FR-20 | Instructor views average peer ratings | F-07 | S3 | AC-07-07 | TEST-07-02, TEST-07-08 | Contract only (PR #54) |
| FR-21 | Instructor course dashboard | F-08 Dashboard | S3 | AC-08-01 … AC-08-05, AC-08-07 | TEST-08-01 … TEST-08-05, TEST-08-07 | Contract only (merged PR #50, v1.1) |
| FR-22 | Audit entries for decisions, grade releases, membership changes | F-09 Audit log | S3 | AC-09-01 … AC-09-10 | TEST-09-01, TEST-09-02 (L-U); TEST-09-03 … TEST-09-09 (L-API); TEST-09-12 (E2E) | Partial: proposal decisions (step A1) implemented, tests pass on PR #52 (CI run 45561424547 on `3bca213`; review fix `fe304e6` 92/92 locally); membership (A2) and grade release (A3) planned |

## 2. Business rules

| Req | Summary | Feature | Sprint | AC | Tests (file) | Status |
|---|---|---|---|---|---|---|
| BR-01 | One active proposal per team; new one only after `REJECTED` | F-02 | S1 | AC-02-02 | TEST-02-03 (P-U); TEST-02-06, TEST-02-07, TEST-02-08 concurrency (P-API) | Verified (auto); see G-01 |
| BR-02 | No submit after `proposalDeadline` (server time) | F-02 | S1 | AC-02-05, AC-02-06 | TEST-02-02 boundary (P-U); TEST-02-11, TEST-02-12 (P-API) | Verified (auto) |
| BR-03 | Only `DRAFT→SUBMITTED`, `SUBMITTED→APPROVED/REJECTED`; final states | F-02 | S1 | AC-02-04, AC-02-07 | TEST-02-01 all 16 pairs (P-U); TEST-02-10, TEST-02-13 (P-API) | Verified (auto) |
| BR-04 | Reject reason required, ≤ 500 chars | F-02 | S1 | AC-02-09 | TEST-02-04 500/501 boundary (P-U); TEST-02-15 (P-API) | Verified (auto) |
| BR-05 | Only team members act on / read own proposal; only course instructor decides | F-02 | S1 | AC-02-10, AC-02-11 | TEST-02-16, TEST-02-17 (P-API); TEST-02-20 other-team 403 (P-E2E) | Verified (auto) |
| BR-06 | One team per student per course | F-03 | S2 | AC-03-04 | TEST-03-08 incl. concurrency (T-API); DB unique `TeamMember(courseId, userId)` | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending |
| BR-07 | Team size min/max; submit only with ≥ `minTeamSize` members | F-03 (+ change to F-02 submit) | S2 | AC-03-05, AC-03-09 | TEST-03-03 boundaries (T-U); TEST-03-09 incl. concurrency, TEST-03-13 (T-API) | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending (see C-02, C-11) |
| BR-08 | Membership locked after proposal `APPROVED` | F-03 | S2 | AC-03-08 | TEST-03-04 (T-U); TEST-03-12 (T-API) | Implemented, tests pass on PR #56 (CI run 45653168539); merge into `sprint-2` pending |
| BR-09 | Milestone weights ≤ 100 % | F-04 | S2 | AC-04-03 | TEST-04-02 boundary 100/101 (M-U); TEST-04-05, TEST-04-06 concurrency (M-API) | Verified (auto): merged into `sprint-2` (PR #48) |
| BR-10 | Only teams with `APPROVED` proposal submit deliverables | F-05 (depends on F-02) | S2 | AC-05-03 | TEST-05-07 (S-API) | Implemented, tests pass on PR #57 (CI run 45653196163); merge pending |
| BR-11 | Late submissions marked `LATE`; resubmission rule | F-05 | S2 | AC-05-04, AC-05-05, AC-05-06 | TEST-05-02 boundary, TEST-05-03 (S-U); TEST-05-09, TEST-05-10 (S-API) | Implemented, tests pass on PR #57 (CI run 45653196163); merge pending; G-05 resolved in the F-05 contract (C-12) |
| BR-12 | Score within 0..max score; visible only after release | F-06 | S2 | AC-06-02, AC-06-05, AC-06-06 | TEST-06-01 boundaries, TEST-06-03 (G-U); TEST-06-05, TEST-06-08, TEST-06-09 (G-API) | Implemented, tests pass on PR #47 (CI run 45638396394); max score from F-04 (G-04 closed by C-08) |
| BR-13 | No self-rating; once per teammate per milestone; individual ratings hidden | F-07 | S3 | AC-07-03 … AC-07-06 | TEST-07-05, TEST-07-06, TEST-07-07 | Contract only (PR #54) |

F-01 has no business rule of its own. Its internal rules R1–R6 (identical login error, session-only identity, etc.) are recorded in `F-01-auth.md` and trace to FR-01–04 and NFR-01–04 above and below.

## 3. Non-functional requirements (cross-cutting)

NFRs are system responsibilities (SR-01–SR-04 in `features.md` §2), so one NFR can link to several features. *Established* = the sprint where the mechanism is built; *Verified* = the sprint(s) where its check runs.

| Req | Summary | Responsibility / features | Established | Verified | Sprint 1 evidence (AC → tests, file) | Status |
|---|---|---|---|---|---|---|
| NFR-01 | bcrypt hashes only; no password / token hash in any response | F-01 (`auth/password.js`, `auth/session.js`) | S1 | S1 | AC-01-01, AC-01-09 → TEST-01-02, TEST-01-03 (A-U); TEST-01-04, TEST-01-12 (A-API) | Verified (auto) |
| NFR-02 | Unauthenticated → 401, no private data | SR-01 Access control (`requireAuth`); every feature | S1 | S1, re-checked each sprint | AC-01-05 → TEST-01-08, TEST-01-09 (A-API); AC-02-12 → TEST-02-18 (P-API) | Verified (auto) for F-01, F-02 |
| NFR-03 | Role + ownership enforced in backend, 403, no private data | SR-01 Access control (`requireRole` + ownership checks); every feature | S1 | every sprint | AC-01-07, AC-01-08 → TEST-01-11, TEST-01-12; AC-02-10, AC-02-11 → TEST-02-16, TEST-02-17; UI 403 → TEST-01-13, TEST-02-20 | Verified (auto) for F-01, F-02 |
| NFR-04 | Session expiry (8 h) and revocation on logout | F-01 (`auth/session.js`) | S1 | S1 | AC-01-05, AC-01-06 → TEST-01-01 boundary (A-U); TEST-01-09, TEST-01-10 (A-API) | Verified (auto) |
| NFR-05 | One error shape; 5xx without stack/SQL | SR-02 Error handling & integrity (`errors.js`) | S1 | S2 | 400/401/403/404/409 shapes asserted in A-API and P-API; unknown route → H "unknown API route returns the standard error shape" | Partial — forced-500 test planned S2 (G-02) |
| NFR-06 | Rules + DB constraints; no partial data on rejection | SR-02 Error handling & integrity (services + Prisma schema) | S1 | every sprint | DB state checked after negative tests: TEST-02-06, TEST-02-08, TEST-02-09, TEST-02-12, TEST-02-13, TEST-02-15, TEST-02-16, TEST-02-17; TEST-01-05 (no session row) | Verified (auto) for S1; see G-01 |
| NFR-07 | Clone → `.env` → migrate → seed → test in ≤ 15 min from README | SR-03 Engineering baseline (README) | S1 | S1 (not met), S2 rerun, S3 | Manual run by 67070507216 on 2026-11-09 (PR #10 comment, `bb734b0`): fresh clone, new databases, README only; 62/62 tests, E2E 4/4, **21 min 36 s** | **Run, not met** (target ≤ 15 min) — see G-06 |
| NFR-08 | Config via env vars; no secrets in Git/client; single Docker container | SR-03 Engineering baseline (`config.js`, `.env.example`; Lab 5 deployment) | S1 design | Lab 5 (S2) | `.env` and `.env.test` git-ignored; `.env.example` has placeholders only | Partial — secret scan + Docker build in Lab 5 |
| NFR-09 | Loading / empty / error states; field validation messages | SR-04 Quality & UX standards (client pages) | S1 | every sprint | TEST-01-13 (invalid login error), TEST-02-20 (A-E2E, P-E2E); screenshots `F01-1-invalid-login.png`, `F02-1-student-validation.png` | Partial — UI review checklist per sprint (G-07) |
| NFR-10 | List endpoints p95 < 500 ms at 50 teams × 3 students | SR-04 Quality & UX standards (roster, proposal list, F-08 dashboard) | S3 | S3 | — | Planned |
| NFR-11 | ≥ 80 % line coverage of domain-rule modules; every AC verified | SR-04 Quality & UX standards (test suite) | S2 | S2, S3 | Every Sprint 1 AC (AC-01-01…11, AC-02-01…14) has ≥ 1 test above; coverage tool not configured yet | Partial — `vitest --coverage` from S2 |

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

### 3.2 Sprint 2 and Sprint 3 acceptance criteria: implementation and verification status (2026-11-25, v0.6)

One row per AC of the current contract on its branch. *Verification* says whether the tests **ran** and what they showed; a test that has not run is never shown as passing. Refresh on the candidate commit.

| AC | Implemented | Tests (contract STS) | Verification status |
|---|---|---|---|
| AC-03-01 | Yes, PR #56 (`10ce17a`) | TEST-03-02, TEST-03-05 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-02 | Yes, PR #56 (`10ce17a`) | TEST-03-01, TEST-03-06 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-03 | Yes, PR #56 (`10ce17a`) | TEST-03-07 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-04 | Yes, PR #56 (`10ce17a`) | TEST-03-08 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-05 | Yes, PR #56 (`10ce17a`) | TEST-03-03, TEST-03-09 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-06 | Yes, PR #56 (`10ce17a`) | TEST-03-01, TEST-03-10 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-07 | Yes, PR #56 (`10ce17a`) | TEST-03-11 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-08 | Yes, PR #56 (`10ce17a`) | TEST-03-04, TEST-03-12 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-09 | Yes, PR #56 (`10ce17a`) | TEST-03-03, TEST-03-13 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-10 | Yes, PR #56 (`10ce17a`) | TEST-03-14 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-11 | Yes, PR #56 (`10ce17a`) | TEST-03-15 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-12 | Yes, PR #56 (`10ce17a`) | TEST-03-16 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-03-13 | Yes, PR #56 (`10ce17a`) | TEST-03-17 | Ran and passed: 152/152 locally, CI run 45653168539; merge into `sprint-2` pending |
| AC-04-01 | Yes, merged (PR #48, `135d4a3`) | TEST-04-03 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-02 | Yes, merged (PR #48, `135d4a3`) | TEST-04-01, TEST-04-04 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-03 | Yes, merged (PR #48, `135d4a3`) | TEST-04-02, TEST-04-05, TEST-04-06, TEST-04-13 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-04 | Yes, merged (PR #48, `135d4a3`) | TEST-04-07, TEST-04-14b | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-05 | Yes, merged (PR #48, `135d4a3`) | TEST-04-08, TEST-04-14 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-06 | Yes, merged (PR #48, `135d4a3`) | TEST-04-09, TEST-04-09b | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-07 | Yes, merged (PR #48, `135d4a3`) | TEST-04-10 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-08 | Yes, merged (PR #48, `135d4a3`) | TEST-04-11 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-04-09 | Yes, merged (PR #48, `135d4a3`) | TEST-04-12 | Ran and passed: 114/114, CI run 45577625107 (Verified, auto) |
| AC-05-01 | Yes, PR #57 (`fef1a22`) | TEST-05-05 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-02 | Yes, PR #57 (`fef1a22`) | TEST-05-01, TEST-05-06 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-03 | Yes, PR #57 (`fef1a22`) | TEST-05-07 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-04 | Yes, PR #57 (`fef1a22`) | TEST-05-02, TEST-05-08 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-05 | Yes, PR #57 (`fef1a22`) | TEST-05-02, TEST-05-09 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-06 | Yes, PR #57 (`fef1a22`) | TEST-05-03, TEST-05-10 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-07 | Yes, PR #57 (`fef1a22`) | TEST-05-04, TEST-05-11 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-08 | Yes, PR #57 (`fef1a22`) | TEST-05-12 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-09 | Yes, PR #57 (`fef1a22`) | TEST-05-13 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-10 | Yes, PR #57 (`fef1a22`) | TEST-05-14 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-05-11 | Yes, PR #57 (`fef1a22`) | TEST-05-15 | Ran and passed: 180/180 locally, CI run 45653196163; merge pending |
| AC-06-01 | Yes, PR #47 (`34ad6c6`) | TEST-06-04 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-02 | Yes, PR #47 (`34ad6c6`) | TEST-06-01, TEST-06-05 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-03 | Yes, PR #47 (`34ad6c6`) | TEST-06-02, TEST-06-06 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-04 | Yes, PR #47 (`34ad6c6`) | TEST-06-02, TEST-06-07, TEST-06-07b | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-05 | Yes, PR #47 (`34ad6c6`) | TEST-06-03, TEST-06-08 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-06 | Yes, PR #47 (`34ad6c6`) | TEST-06-09 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-07 | Yes, PR #47 (`34ad6c6`) | TEST-06-10 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-08 | Yes, PR #47 (`34ad6c6`) | TEST-06-11 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-09 | Yes, PR #47 (`34ad6c6`) | TEST-06-12 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-06-10 *(v1.1)* | Yes, PR #47 (`34ad6c6`) | TEST-06-13 | Ran and passed: 206/206 ×3 locally, CI run 45638396394; merge pending |
| AC-07-01 | No | TEST-07-03 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-02 | No | TEST-07-01, TEST-07-04 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-03 | No | TEST-07-05 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-04 | No | TEST-07-05 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-05 | No | TEST-07-06 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-06 | No | TEST-07-07 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-07 | No | TEST-07-02, TEST-07-08 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-08 | No | TEST-07-09 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-07-09 | No | TEST-07-10 | Not run: contract only (PR #54); implementation planned (Part C plan) |
| AC-08-01 | No | TEST-08-01, TEST-08-03 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-02 | No | TEST-08-02 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-03 | No | TEST-08-02 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-04 | No | TEST-08-04 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-05 | No | TEST-08-05 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-06 | No | TEST-08-06 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-08-07 | No | TEST-08-07 | Not run: contract only (merged PR #50, v1.1); implementation planned |
| AC-09-01 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-02, TEST-09-03 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-02 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-02, TEST-09-04 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-03 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-05 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-04 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-06 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-05 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-01, TEST-09-07 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-06 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-08 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-07 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-09 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |
| AC-09-08 *(A2)* | No (step A2) | TEST-09-10 | Not run: planned after F-03 / F-06 merge |
| AC-09-09 *(A3)* | No (step A3) | TEST-09-11 | Not run: planned after F-03 / F-06 merge |
| AC-09-10 | Step A1: yes, PR #52 (`fe304e6`) | TEST-09-12 | Ran and passed: CI run 45561424547 on `3bca213`, 92/92 locally on `fe304e6` |

## 4. Coverage gaps

Requirements, or parts of them, that are not fully verified at the end of Sprint 1. Each one has an owner sprint.

*Status on 2026-11-25 (v0.6):* G-02 is covered by TEST-09-06 (forced 500, PR #52, CI run 45561424547); G-03 is covered for proposal decisions by F-09 step A1 (PR #52); G-04 is closed by the F-04 max score (C-08); G-05 is resolved in the F-05 contract (C-12); G-06 is still open. Details: `docs/deliverable2/change-register.md` §2.

| ID | Requirement | Gap | Plan |
|---|---|---|---|
| G-01 | BR-01, NFR-06 | BR-01 is enforced by a transaction with a team row lock (`SELECT … FOR UPDATE`), **not** by a DB constraint. A partial unique index (`WHERE status <> 'REJECTED'`) cannot be expressed in the Prisma schema. | Accepted limitation for S1 (F-02 §4, §9); TEST-02-08 proves 5 concurrent creates give exactly one row. A DB-level guard (e.g. a raw-SQL partial index in a migration) is planned for S3 hardening if feasible (`plan.md` §5). |
| G-02 | NFR-05 | No test forces an unexpected error to prove a 500 response hides stack traces and SQL. | Add forced-error API test in S2. |
| G-03 | FR-22 | F-02 decisions (approve/reject) are not written to an audit log yet; `decidedAt`, `decidedById` and `rejectReason` on `Proposal` are the Sprint 1 record. | F-09 in S3 adds `AuditLog` entries for proposal decisions. |
| G-04 | FR-13, BR-12 | BR-12 refers to a milestone's maximum score, but FR-13 lists only title, description, due date and weight. | Add max score to FR-13 when the F-04 contract is written (S2). |
| G-05 | BR-11 | Wording does not say whether a team whose first submission was already late may resubmit late. | Resolve in the F-05 contract (S2) and record in SRS §9. |
| G-06 | NFR-07 | The README run on 2026-11-09 (PR #10) passed every step and test but took 21 min 36 s, over the 15 min target. About 10 min went to finding how to start PostgreSQL and which port and password go into `DATABASE_URL`, which the README does not explain. An earlier clean-clone attempt on `a32fbe4` found two setup failures, fixed in PR #10 (C-06). | S2: add a PostgreSQL subsection to the README, then repeat the run on a clean clone and record it; re-verify in S3 as planned. |
| G-07 | NFR-09 | Empty/loading states are implemented on all Sprint 1 screens but only error/validation states are covered by E2E tests. | UI review checklist recorded per sprint from S2. |
| G-08 | Sprint 1 scope | SRS Q-05 closed on 2026-11-10 (SRS v0.2, PR #14) **without** comparing against the theme's Sprint 1 example: the full `group_work_specs.docx` was not available. The registration sheet confirms theme 6 (CPMS) and the Sprint 1 roles Student / Supervisor (Supervisor = Instructor). The slice was checked against the required Sprint 1 outcome in `project_deliverable_1_v1.pdf` §2 instead. | Disclosed as a known limitation in Part F. If the document is obtained, compare the slice with its Sprint 1 example and record any difference in SRS §9 and here. |

## 5. Approved changes

Changes to requirements, contracts or tests after their first version. Each one is visible in the version history of the named document.

| ID | Date | Document / version | Change | Reason | Approved by |
|---|---|---|---|---|---|
| C-01 | 2026-11-07 | F-01 contract v1.1 | Added `GET /api/courses`, AC-01-11, TEST-01-14 | Home page needs the user's courses; scoped by session user, no new data | jaruwan18 (PR #3 review) |
| C-02 | 2026-11-07 (planned for S2) | F-02 contract (next version) | FR-06 submit will also check BR-07 (team has ≥ `minTeamSize` members); BR-08 locks membership after approval | BR-07/BR-08 belong to F-03, which arrives in S2; Sprint 1 teams are seeded (SRS A-02) | To be approved in the F-03 PR |
| C-03 | 2026-11-07 | F-02 contract v1.1 | Role check (403) runs before input validation (400); review list opens on "Submitted" | Reuses F-01 `requireRole`; no AC or test changed | Film26 (PR #6 review) |
| C-04 | 2026-11-07 | F-02 contract v1.2 | E2E tests run on a separate `cpms_e2e` database; TEST-02-20 precondition updated | PR #6 review found E2E cleanup could delete `cpms_dev` data | Film26 (PR #6 review) |
| C-05 | 2026-11-07 | System SDS v0.2 | Role/permission matrix names the real F-02 endpoints and adds `GET /api/courses/:courseId/my-team`; §2.2 records how BR-01 is enforced | PR #4 review by jaruwan18 | jaruwan18 (PR #4 review) |
| C-06 | 2026-11-09 | `server/package.json` (PR #10) | Database scripts call `dotenv-cli` by its own bin name; server `postinstall` runs `prisma generate` | A clean clone failed at `npm run db:migrate` and `npm run db:seed` when following the README (NFR-07) | Film26 (PR #10 review) |
