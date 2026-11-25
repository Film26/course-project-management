# Deliverable 2 — Part E: Integrated Release Candidate and Completion Plan

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Status date | 2026-11-25 (fill the _to fill_ cells on the tag day) |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-25 | 67070507202 | Release path, regression set, deployment checks, readiness review and dated plan to 13 Dec. Drafted with an AI assistant (Claude Code) |

## 1. Release path (no shortcut into `main`)

Every merge into `main` deploys to Cloud Run through the Lab 5 pipeline (CI → image → Cloud Run → smoke test), so the
candidate is built in two releases:

| Step | PR | Result |
|---|---|---|
| 1 | Feature PRs into `sprint-2`: #56 (F-03) → #57 (F-05) → #47 (F-06); F-04 already merged (#48) | Sprint 2 integrated, CI on each PR |
| 2 | `sprint-2` → `staging` (PR #59) → `main` | tag **`v2.0-sprint2`** = the accepted Sprint 2 release (stays identifiable) |
| 3 | `sprint-2` merged into `sprint-3` (PR #61; 229/229, E2E 9/9); Sprint 3 PRs #52 (F-09 A1), #54 (F-07 contract), #58 (plan v0.4), #53 (docs) | Sprint 3 progress integrated |
| 4 | `sprint-3` → `staging` (PR #60) → `main` | tag **`d2-candidate`** = the submitted Deliverable 2 version |

| Release | Commit | Tag | CI run | Deploy demo run | Cloud Run revision | `/api/version` |
|---|---|---|---|---|---|---|
| Sprint 2 | _to fill_ | `v2.0-sprint2` | _to fill_ | _to fill_ | _to fill_ | _to fill_ |
| D2 candidate | _to fill_ | `d2-candidate` | _to fill_ | _to fill_ | _to fill_ | _to fill_ |

## 2. Regression and integration checks on the candidate commit

| Check | Command / place | Expected | Result |
|---|---|---|---|
| Backend unit + API/DB | `npm test` (CI job `test-and-docker`) | all pass, counts printed | _to fill_ (206/206 on `34ad6c6` + F-09 A1 tests after the sprint-3 merge) |
| UI journeys | `npm run test:e2e` | TEST-01-13, 01-13b, 02-20, 02-20b (Sprint 1 continuity), 03-17, 04-12, 05-15, 06-12, 09-12 | _to fill_ |
| Cross-feature rules | in `npm test` | BR-07 on submit (TEST-03-13), BR-10 (TEST-05-07), D-08 resubmit after release (TEST-06-09), `SCORE_ABOVE_MAX` (TEST-06-09), milestone delete with submissions (TEST-05-13), audit entry with decision (TEST-09-03/06) | _to fill_ |
| Docker + container smoke test | CI job `test-and-docker` | migrate + seed twice, container serves `/api/ready` | _to fill_ |
| Migrations on existing data | local copy of a Sprint 1 database (F-03 evidence) | back-fill of codes, enrollments, `TeamMember.courseId`; seed adds student4 once | done on 25 Nov (F-03 GREEN evidence) |

Failed or skipped tests are listed here with their reason; tests are never weakened to pass.

## 3. Post-deployment checks (deployed candidate)

| Check | How | Expected | Result |
|---|---|---|---|
| Version | `GET /api/version` | `commit` = candidate commit | _to fill_ |
| Readiness | `GET /api/ready` | `{"status":"ready","db":"connected"}` | _to fill_ |
| Critical journey (Sprint 1) | by hand on the URL, screenshots | proposal submit → reject with reason → resubmit → approve | _to fill_ |
| Sprint 2 journey | by hand | create/join team (student5/6), milestone list, submit URL, grade + release after due date | _to fill_ |
| Persistence | after a new revision (restart, as in Lab 5 C-05) | records from the journey are still there | _to fill_ |
| Seed on deploy | Deploy log | "0 new milestones" on an existing database; no membership re-added | _to fill_ |

## 4. Readiness review (25 Nov 2026)

| Area | State | Risk / action |
|---|---|---|
| Sprint 2 (F-03 … F-06) | Implemented with contracts, RED → GREEN, CI green on every PR | Merge order #56 → #57 → #47; each needs the reviewer's approval |
| Sprint 3 | F-09 step A1 implemented and tested; F-07 and F-08 contracts | F-07, F-08, F-09 A2/A3 remain (plan below) |
| Requirements / traceability | SRS v0.3, SDS v0.3, features v0.3, traceability v0.6 | Refresh statuses on the candidate |
| UAT | Sprint 1 accepted (round 1); #36 fixed, UAT Team re-test pending | Ask the UAT Team to post on #33 |
| Deployment | Lab 5 pipeline unchanged; four new migrations | Migrations checked on a copy of Sprint 1 data; Cloud SQL must be running before the deploy |
| Known limitations | BR-01 and BR-09 enforced by transactions with row locks (no DB constraint); proposal #3 empty reason (D-02); NFR-07 over target (G-06) | Disclosed in Part A and traceability §4 |

## 5. Completion plan to 13 December 2026

Final examination period 1–11 Dec: no main workflow is left for the last two days.

| Feature / item | Current status | Remaining action | Owner | Target |
|---|---|---|---|---|
| F-03, F-05, F-06 | Implemented, PRs #56 / #57 / #47 | Review, merge, release `v2.0-sprint2` | 67070507202 (review 67070507216) | 27 Nov |
| F-09 A2 (membership entries) | A1 done (PR #52) | `record(tx, …)` in F-03 create/join/leave + TEST-09-10 | 67070507202 | 30 Nov |
| F-09 A3 (grade release entry) | — | `record` in F-06 release + TEST-09-11 | 67070507202 | 30 Nov |
| F-08 Course dashboard | Contract v1.1 (PR #50) | RED → GREEN, TEST-08-01 … 05, 07; perf seed + `cpms-perf` measurement (TEST-08-06, NFR-10) | 67070507202 | 4 Dec |
| F-07 Peer evaluation | Contract (PR #54) | RED → GREEN, TEST-07-01 … 10 | 67070507202 | 6 Dec |
| NFR-07 README rerun (G-06) | Open | Clean-machine run ≤ 15 min, recorded | 67070507216 | 8 Dec |
| NFR-11 coverage | Not configured | `vitest --coverage` for rule modules ≥ 80 % | 67070507202 | 8 Dec |
| UAT re-test of Sprint 2 scope | — | Handoff to the UAT Team, triage findings | both | 9 Dec |
| Final regression, release, demo video | — | Full E2E, tag `v3.0-final`, deploy, video | both | 12 Dec |
| Final submission | — | PDF + release | both | 13 Dec |
