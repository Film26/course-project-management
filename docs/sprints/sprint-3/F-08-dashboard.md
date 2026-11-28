# F-08 Course Dashboard — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-08 Course Dashboard |
| Sprint | 3 |
| GitHub Issue | #45 |
| Branch | `feature/F-08-dashboard` (from `sprint-3`) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-21, NFR-10, NFR-02, NFR-03, NFR-09 |
| Depends on | F-02 (proposals), F-03 (teams), F-04 (milestones), F-05 (submissions), F-06 (grades) |
| Used by | — (read-only view) |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-25 | Film26 | Initial contract: design, API, data, UI, AC, STS (incl. NFR-10 measurement), DoD | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md` and the F-02 … F-06 contracts |
| 1.1 | 2026-11-25 | Film26 | D2: "newest rejected" = `decidedAt` desc, then `id` desc; grade state is one shape everywhere (`grade: { state: NONE \| GRADED \| RELEASED, score }`); D3: rounding half up to 2 decimals on the team total only; §4/TEST-08-06: measured on a separate Cloud Run service `cpms-perf` with its own database `cpms_perf` on the same Cloud SQL instance, fixed conditions (Cloud Shell in `asia-southeast1`, 20 warm-up + 200 measured requests, concurrency 10, commit **and** revision recorded); NFR-10 measured for all three list endpoints (roster, proposal list, dashboard); DoD lists RED/GREEN and performance evidence; STS names every AC in full | PR #50 review by jaruwan18 (points 1–5): the seed could not run against the UAT database `cpms`; NFR-10 names three endpoints; DoD had no TDD evidence; two grade shapes; tie order not defined |
| 1.2 | 2026-11-28 | Film26 | Implementation details made explicit, no rule changed: §3 module signature is `cellFor(milestone, versions)` (each version carries its grade) instead of `cellFor(submissions, grade)`; D3 a team without released grades has `releasedWeightedScore: 0`; `perMilestone.submitted` = teams with at least one version (on time or late); D4 measured at **6** queries (submissions and their grades are 2); the test Prisma client emits query events (only when `NODE_ENV=test`); §8 DoD ticked with evidence; TEST-08-06 run locally as an indicative check, the reference run on `cpms-perf` is still to do | Written with the implementation (RED `4d7b8e7` before code); code and tests drafted with Claude Code, checked by the owner |

## 1. Linked requirements (summary)

| ID | Requirement / rule |
|---|---|
| FR-21 | An Instructor can view a course dashboard: per team proposal status, milestone submissions, late count and released grades. |
| NFR-10 | List endpoints (roster, proposal list, **dashboard**) respond in p95 < 500 ms with 50 teams × 3 students on the reference deployment. |
| NFR-02 / 03 / 09 | 401; only the course instructor (403, no data); loading / empty / error states. |

## 2. Behaviour

### Rules as implemented
- **D1 Read-only.** The dashboard changes nothing. It shows what the other features stored; it never recalculates `isLate` or grades.
- **D2 Per team.** For each team in the course (sorted by name): member count; the **current** proposal (the active one, otherwise the newest `REJECTED` by `decidedAt` desc then `id` desc, otherwise none) *(v1.1)* with status; for each milestone: `NOT_SUBMITTED` / `SUBMITTED` / `LATE` from the current version, the number of versions, and the grade as `{ state: NONE | GRADED | RELEASED, score }` (`score` null for `NONE`) *(v1.1: same shape as the API)*.
- **D3 Totals.** Per team: `lateCount` (milestones whose current version is late), `releasedCount`, `releasedWeightedScore` = Σ (score / maxScore × weight) over released grades, computed on the exact sum and rounded **once**, half up, to 2 decimals *(v1.1)* (informative; not a final course grade). Per course: number of teams, proposals by status, submissions per milestone, late submissions per milestone.
- **D4 Query budget (NFR-10).** The response is built from a fixed number of queries (≤ 6: course, teams + member counts, proposals, milestones, current submissions, grades), never one query per team or per milestone.
- **D5 Ownership.** Role INSTRUCTOR and owns the course; everyone else 403.

## 3. API contract

| Method & path | Who | Success | Errors |
|---|---|---|---|
| `GET /api/courses/:courseId/dashboard` | INSTRUCTOR, owns course | `200 { course: { id, code, name }, milestones: [ { id, title, dueAt, weight, maxScore } ], teams: [ { id, name, memberCount, proposal: { id, title, status } \| null, cells: [ { milestoneId, status, versionCount, grade: { state, score } } ], lateCount, releasedCount, releasedWeightedScore } ], totals: { teams, proposals: { DRAFT, SUBMITTED, APPROVED, REJECTED, NONE }, perMilestone: [ { milestoneId, submitted, late } ] } }` | 400, 401, 403, 404 |

Modules: `src/dashboard/rules.js` (pure: `currentProposal(proposals)`, `cellFor(submissions, grade)`, `teamTotals(cells, milestones)`), `src/dashboard/service.js` (the ≤ 6 queries, D4), `src/routes/courses.js` (route).

## 4. Data
**No schema change, no migration.** Uses `Team`, `TeamMember`, `Proposal`, `Milestone`, `Submission` (`isLate`, current = highest `version`, F-05) and `Grade` (F-06).

**Performance data and environment *(v1.1)*.** `server/scripts/seed-perf.js` creates a course `PERF50` (50 teams × 3 students, 4 milestones, 2 versions per team and milestone, grades) and refuses to run unless the database name contains `perf` or `test`. The measurement runs against a **separate Cloud Run service `cpms-perf`** (same image and commit as the candidate) connected to its **own database `cpms_perf`** on the existing Cloud SQL instance `cpms-pg`, so the UAT data in `cpms` is never touched. The service is deleted after the measurement.

## 5. UI
| Screen | Behaviour |
|---|---|
| Home — course card (Instructor) | New button **"Dashboard"**. |
| Dashboard (Instructor) | Loading / empty ("No teams yet") / error states. Summary tiles: teams, proposals by status, late submissions. Table: one row per team; columns proposal status, then one column per milestone (badge Not submitted / Submitted v2 / Late, grade "85 / 100 ✓" when released or "85 (draft)" when not), late count, weighted released score. Horizontal scroll on narrow screens. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-08-01 | The course instructor gets one row per team with member count and the current proposal status (active, else newest rejected, else none). | FR-21 |
| AC-08-02 | Each team × milestone cell shows the current version status (`NOT_SUBMITTED` / `SUBMITTED` / `LATE`), the version count and the grade state; `lateCount` counts late current versions. | FR-21 |
| AC-08-03 | `releasedWeightedScore` uses released grades only; an unreleased grade is shown as `GRADED` but not counted. | FR-21, BR-12 |
| AC-08-04 | Course totals match the rows (teams, proposals by status, submitted / late per milestone). | FR-21 |
| AC-08-05 | A student, an instructor of another course → 403 without data; no session → 401; unknown course → 404; `abc` → 400. | NFR-02, NFR-03 |
| AC-08-06 | With 50 teams × 3 students × 4 milestones, the roster, the proposal list and the dashboard endpoints each have p95 < 500 ms *(v1.1)* over 200 requests on the reference deployment; the measurement and the commit are recorded. | NFR-10 |
| AC-08-07 | UI: instructor1 opens the dashboard and sees Team Alpha APPROVED with M1 "Submitted v2" and "85 / 100 ✓", Team Beta with no proposal. | FR-21, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Input | Expected |
|---|---|---|---|---|
| TEST-08-01 | AC-08-01 | Unit | `currentProposal` with [], [REJECTED old, REJECTED new], [REJECTED, DRAFT], [APPROVED] | null, newest REJECTED, DRAFT, APPROVED |
| TEST-08-02 | AC-08-02, AC-08-03 | Unit | `cellFor` / `teamTotals` with no versions, on-time v2, late v1, graded not released, released 85/100 weight 20 | statuses; `lateCount`; weighted 17.00 counts the released grade only |
| TEST-08-03 | AC-08-01 … 04 | API+DB | Alpha: APPROVED, M1 v1+v2 on time, released 85; M2 late v1, graded 70 not released. Beta: no proposal, nothing submitted | rows, cells and totals exactly as specified |
| TEST-08-04 | AC-08-04 (D4) | API+DB | same data; count Prisma queries with a query-event listener | ≤ 6 queries for 2 teams and for 20 teams (no growth per team) |
| TEST-08-05 | AC-08-05 | API+DB | student1, instructor2, no cookie, 999999, `abc` | 403 ×2 (no `teams` in body), 401, 404, 400 |
| TEST-08-06 *(v1.1)* | AC-08-06 | Performance (manual, recorded) | `cpms-perf` + `cpms_perf` seeded with `PERF50` (§4); from Cloud Shell in `asia-southeast1` | `node server/scripts/perf-lists.js <cpms-perf URL> --warmup 20 --requests 200 --concurrency 10` on the roster, the proposal list and the dashboard of `PERF50` | p50 / p95 / max per endpoint printed; each p95 < 500 ms; output with commit **and** Cloud Run revision in `docs/sprints/sprint-3/evidence/F-08-perf.txt` |
| TEST-08-07 | AC-08-07 | E2E | `cpms_e2e` with the TEST-08-03 data | journey of AC-08-07; screenshots `F08-*.png` |

## 8. Definition of Done
- [x] AC-08-01 … 05, 07; TEST-08-01 … 05 in `npm test` (`server/tests/dashboard.unit.test.js`, `dashboard.api.test.js`, 13 tests), TEST-08-07 in E2E (`e2e/dashboard.spec.js`).
- [ ] AC-08-06 / TEST-08-06 on the reference deployment `cpms-perf` → `F-08-perf.txt`. *(v1.2: scripts `server/scripts/seed-perf.js` and `perf-lists.js` done; local indicative run in `F-08-perf-local.txt`: p95 roster 45.7 ms, proposal list 44.0 ms, dashboard 43.6 ms — not the reference deployment.)*
- [x] Red → green evidence: `evidence/F-08-tdd-red.txt` (13 failed on `4d7b8e7`), `evidence/F-08-tdd-green.txt` (13/13; whole server suite 282/282; E2E 13/13); screenshot `F08-1-instructor-dashboard.png`.
- [x] No schema change; F-01 … F-07 tests still pass.
- [ ] PR into `sprint-3` reviewed by jaruwan18; `Closes #45`.

## 9. Known limitations
- `releasedWeightedScore` is informative only; the baseline has no final course grade.
- The performance target is measured once on the reference deployment, not in CI.
