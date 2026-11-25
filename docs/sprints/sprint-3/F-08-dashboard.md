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

## 1. Linked requirements (summary)

| ID | Requirement / rule |
|---|---|
| FR-21 | An Instructor can view a course dashboard: per team proposal status, milestone submissions, late count and released grades. |
| NFR-10 | List endpoints (roster, proposal list, **dashboard**) respond in p95 < 500 ms with 50 teams × 3 students on the reference deployment. |
| NFR-02 / 03 / 09 | 401; only the course instructor (403, no data); loading / empty / error states. |

## 2. Behaviour

### Rules as implemented
- **D1 Read-only.** The dashboard changes nothing. It shows what the other features stored; it never recalculates `isLate` or grades.
- **D2 Per team.** For each team in the course (sorted by name): member count; the **current** proposal (the active one, otherwise the newest `REJECTED`, otherwise none) with status; for each milestone: `NOT_SUBMITTED` / `SUBMITTED` / `LATE` from the current version, the number of versions, and the grade state `NONE` / `GRADED` / `RELEASED` with the score shown to the instructor.
- **D3 Totals.** Per team: `lateCount` (milestones whose current version is late), `releasedCount`, `releasedWeightedScore` = Σ (score / maxScore × weight) over released grades, rounded to 2 decimals (informative; not a final course grade). Per course: number of teams, proposals by status, submissions per milestone, late submissions per milestone.
- **D4 Query budget (NFR-10).** The response is built from a fixed number of queries (≤ 6: course, teams + member counts, proposals, milestones, current submissions, grades), never one query per team or per milestone.
- **D5 Ownership.** Role INSTRUCTOR and owns the course; everyone else 403.

## 3. API contract

| Method & path | Who | Success | Errors |
|---|---|---|---|
| `GET /api/courses/:courseId/dashboard` | INSTRUCTOR, owns course | `200 { course: { id, code, name }, milestones: [ { id, title, dueAt, weight, maxScore } ], teams: [ { id, name, memberCount, proposal: { id, title, status } \| null, cells: [ { milestoneId, status, versionCount, grade: { score, released } \| null } ], lateCount, releasedCount, releasedWeightedScore } ], totals: { teams, proposals: { DRAFT, SUBMITTED, APPROVED, REJECTED, NONE }, perMilestone: [ { milestoneId, submitted, late } ] } }` | 400, 401, 403, 404 |

Modules: `src/dashboard/rules.js` (pure: `currentProposal(proposals)`, `cellFor(submissions, grade)`, `teamTotals(cells, milestones)`), `src/dashboard/service.js` (the ≤ 6 queries, D4), `src/routes/courses.js` (route).

## 4. Data
**No schema change, no migration.** Uses `Team`, `TeamMember`, `Proposal`, `Milestone`, `Submission`, `Grade`. Performance seed: `server/scripts/seed-perf.js` creates a separate course `PERF50` with 50 teams × 3 students, 4 milestones, 2 versions per team per milestone and grades (only against a database whose name contains `perf` or `test`).

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
| AC-08-06 | With 50 teams × 3 students × 4 milestones, the dashboard endpoint has p95 < 500 ms over 200 requests on the reference deployment; the measurement and the commit are recorded. | NFR-10 |
| AC-08-07 | UI: instructor1 opens the dashboard and sees Team Alpha APPROVED with M1 "Submitted v2" and "85 / 100 ✓", Team Beta with no proposal. | FR-21, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Input | Expected |
|---|---|---|---|---|
| TEST-08-01 | AC-08-01 | Unit | `currentProposal` with [], [REJECTED old, REJECTED new], [REJECTED, DRAFT], [APPROVED] | null, newest REJECTED, DRAFT, APPROVED |
| TEST-08-02 | AC-08-02, 03 | Unit | `cellFor` / `teamTotals` with no versions, on-time v2, late v1, graded not released, released 85/100 weight 20 | statuses; `lateCount`; weighted 17.00 counts the released grade only |
| TEST-08-03 | AC-08-01 … 04 | API+DB | Alpha: APPROVED, M1 v1+v2 on time, released 85; M2 late v1, graded 70 not released. Beta: no proposal, nothing submitted | rows, cells and totals exactly as specified |
| TEST-08-04 | AC-08-04 (D4) | API+DB | same data; count Prisma queries with a query-event listener | ≤ 6 queries for 2 teams and for 20 teams (no growth per team) |
| TEST-08-05 | AC-08-05 | API+DB | student1, instructor2, no cookie, 999999, `abc` | 403 ×2 (no `teams` in body), 401, 404, 400 |
| TEST-08-06 | AC-08-06 | Performance (manual, recorded) | `seed-perf.js`, then `node server/scripts/perf-dashboard.js <URL> 200` on Cloud Run | p50 / p95 / max printed; p95 < 500 ms; result + commit in `evidence/F-08-perf.txt` |
| TEST-08-07 | AC-08-07 | E2E | `cpms_e2e` with the TEST-08-03 data | journey of AC-08-07; screenshots `F08-*.png` |

## 8. Definition of Done
- [ ] AC-08-01 … 07; TEST-08-01 … 05 in `npm test`, TEST-08-07 in E2E, TEST-08-06 measured and recorded.
- [ ] No schema change; F-01 … F-07 tests still pass.
- [ ] PR into `sprint-3` reviewed by jaruwan18; `Closes #45`.

## 9. Known limitations
- `releasedWeightedScore` is informative only; the baseline has no final course grade.
- The performance target is measured once on the reference deployment, not in CI.
