# F-06 Grading & Feedback — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-06 Grading & Feedback |
| Sprint | 2 |
| GitHub Issue | #43 |
| Branch | `feature/F-06-grading` (from `sprint-2`, after F-05 is merged) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-17, FR-18, BR-12, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01; F-04 (`Milestone.maxScore`); F-05 (`Submission`, current version) |
| Used by | F-08 dashboard (released grades), F-09 audit (grade release) |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-24 | Film26 | Initial contract: design, API, data, UI, AC, STS, DoD; proposes decision D-08 | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md` and the F-04/F-05 contracts |
| 1.1 | 2026-11-25 | Film26 | D-08: a grade can be released only **after** the milestone due date (G3a, 409 `BEFORE_DUE`), so FR-16 is unchanged; release also requires the current version (G3b); `PUT` is a conditional write; grade, release and F-05 submit lock the same team row (G8, new AC-06-10 / TEST-06-13); UI shows "of {maxScore}"; API tests create their own fixtures | PR #47 review by jaruwan18 (points 1–5): D-08 v1.0 blocked resubmission before the due date (conflict with FR-16); an old version could be released; races between submit, grade and release |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement / rule |
|---|---|
| FR-17 | An Instructor can grade a submission (score, written feedback) and release it to the team. |
| FR-18 | Team members can view released grades and feedback for their own team only. |
| BR-12 | A score must be between 0 and the milestone's maximum score; grades are visible to students only after release. |
| NFR-02 / NFR-03 / NFR-05 / NFR-06 / NFR-09 | 401, 403 without data, one error shape, no partial data, loading/empty/error states. |

### Proposed baseline decision (needs teammate approval in the PR, then added to `docs/srs.md` §8)
| ID | Decision | Alternative | Reason |
|---|---|---|---|
| D-08 *(v1.1)* | Only the team's **current** version of a milestone can be graded or released. A grade can be **released only after the milestone due date**, and a released grade is final: it cannot be edited, and the team cannot submit that milestone again (F-05 S5). Before the due date the team can always resubmit (FR-16 unchanged). | Grade any version; allow edits after release; or change FR-16 to "before the due date and before release" | Students never see a grade change silently, a grade always refers to the current work, and FR-16 stays as written (option (ก) of the PR #47 review). |

## 2. Behaviour and workflow

```
 Instructor (course owner)                                         Team member
 ┌──────────────────────────────────────────────────────────┐    ┌─────────────────────────────┐
 │ current submission ─► grade (score 0…max, feedback)      │    │ my grades: released only    │
 │      ▲  edit grade while unreleased                      │    │   milestone, version,       │
 │      │                                                   │    │   score / max, feedback     │
 │ release ─► releasedAt set (final, D-08) ─────────────────┼───►│                             │
 └──────────────────────────────────────────────────────────┘    └─────────────────────────────┘
```

### Business rules as implemented
- **G1 (BR-12, range)** `score` is an integer with `0 ≤ score ≤ milestone.maxScore`; otherwise `400 VALIDATION_ERROR` (`details.score`, message names the maximum). Boundaries 0 and `maxScore` are accepted. Also a DB `CHECK (score >= 0)`; the upper bound depends on another table and is checked in the application.
- **G2 (D-08, current version)** Grading a submission that is not the team's highest version → `409 NOT_CURRENT_VERSION`.
- **G3 (D-08, release is final)** `PUT` on a released grade → `409 GRADE_RELEASED`; release twice → `409 GRADE_RELEASED`; release with no grade → `409 NOT_GRADED`.
  - **G3a (v1.1)** Release requires `now > milestone.dueAt` (server clock), otherwise `409 BEFORE_DUE`. Boundary: releasing exactly at `dueAt` is refused, because a submission at that instant is still on time (F-05 S2).
  - **G3b (v1.1)** Release requires that the graded submission is still the team's current version, otherwise `409 NOT_CURRENT_VERSION` (the team resubmitted after grading). The old grade stays stored but can never be released.
  - Check order for release: `NOT_GRADED` → `GRADE_RELEASED` → `NOT_CURRENT_VERSION` → `BEFORE_DUE`.
- **G4 (BR-12, visibility)** Student endpoints return only grades with `releasedAt` set. An unreleased grade is not returned in any form (no score, no "graded" flag) to students.
- **G5 Ownership.** Grade, release and the instructor view: role INSTRUCTOR **and** owns the course of the submission's milestone. Student view: role STUDENT **and** member of a team in the course; only their own team's grades.
- **G6 Cross-feature.** F-04 `PATCH maxScore` lower than an existing score on that milestone → `409 SCORE_ABOVE_MAX`. F-05 submit after a released grade on that milestone → `409 GRADE_RELEASED` (F-05 S5); because of G3a this can only happen after the due date.
- **G7** Grade time and grader are recorded (`gradedAt`, `gradedById`); release time in `releasedAt`.
- **G8 Concurrency (v1.1, NFR-06).** Grade (`PUT`), release and F-05 submit each run in **one transaction that first locks the team row** (`SELECT … FOR UPDATE` on `Team`, the same lock F-05 S4 uses), then reads the current version and writes. So a submit of v2 and a grade or release of v1 cannot interleave: whichever runs second sees the other's result. In addition `PUT` updates only `WHERE releasedAt IS NULL` and release only `WHERE releasedAt IS NULL`; if no row changed → `409 GRADE_RELEASED`.

### Validation
| Field | Rule | Error |
|---|---|---|
| `score` | required; integer; 0 ≤ score ≤ `maxScore` | 400 `VALIDATION_ERROR`, `details.score` |
| `feedback` | required; string; trimmed; 1–2000 chars | 400, `details.feedback` |
| path ids | positive integers | 400 |

The type checks of `score` and `feedback` run before the DB; the `maxScore` bound is checked after the submission is loaded (still before any write).

## 3. API contract

All endpoints require a session (`401 UNAUTHENTICATED`). Order of checks: authenticate (401) → role (403) → validate shape (400) → load submission (404) → course ownership (403) → score bound (400) → business rule (409) → write.

**Grade object** (`G`): `{ id, submissionId, score, maxScore, feedback, gradedAt, gradedBy: { id, displayName }, releasedAt }`

| Method & path | Who (G5) | Request | Success | Errors |
|---|---|---|---|---|
| `PUT /api/submissions/:id/grade` | INSTRUCTOR owner | `{ score, feedback }` | `200 { grade: G }` (creates or updates while unreleased) | 400, 403, 404, 409 `NOT_CURRENT_VERSION`, 409 `GRADE_RELEASED` |
| `POST /api/submissions/:id/grade/release` | INSTRUCTOR owner | — | `200 { grade: G }` with `releasedAt` | 400, 403, 404, 409 `NOT_GRADED`, 409 `GRADE_RELEASED`, 409 `NOT_CURRENT_VERSION`, 409 `BEFORE_DUE` *(v1.1)* |
| `GET /api/courses/:courseId/my-grades` | STUDENT, member of a team in the course | — | `200 { course, team: { id, name }, grades: [ { milestone: { id, title, weight, maxScore }, version, score, feedback, releasedAt } ] }` (released only, by milestone due date) | 400, 403, 404, 409 `NO_TEAM` |
| `GET /api/milestones/:id/submissions` *(changed, instructor)* | as F-05 | — | each team row adds `grade: G \| null` for the current version | as F-05 |
| `PATCH /api/milestones/:id` *(changed)* | as F-04 | — | as F-04 | + 409 `SCORE_ABOVE_MAX` |
| `POST /api/milestones/:id/submissions` *(changed)* | as F-05 | — | as F-05 | + 409 `GRADE_RELEASED` |

### Application-layer components (server)
| Module | Responsibility |
|---|---|
| `src/grades/rules.js` | Pure logic: `validateGradeShape(body)`, `checkScoreRange(score, maxScore)`, `canGrade({ isCurrent, releasedAt })`, `canRelease({ grade, isCurrent, dueAt, now })` *(v1.1)*, `visibleToStudent(grade)` |
| `src/grades/service.js` | Team row lock + current-version look-up + conditional upsert / release in one transaction (G8), student filtering |
| `src/routes/grades.js` | `/api/submissions/:id/grade…` routes |
| `src/routes/courses.js` | adds `GET /:courseId/my-grades` |

## 4. Data

Migration `20261125010000_f06_grades`:
- New `Grade { id, submissionId Int @unique (FK Submission, cascade), score Int, feedback String, gradedById (FK User), gradedAt DateTime, releasedAt DateTime?, updatedAt }`; SQL `CHECK ("score" >= 0)`.
- One grade per submission (unique). Only the current version can be graded (G2), so a milestone has at most one released grade per team in normal use.
- No seed grades.

## 5. UI
| Screen / element | Behaviour |
|---|---|
| Submissions (Instructor, from F-05) | Each team row with a current version gets **Grade**: score (number, "of {maxScore}" from the milestone) *(v1.1)*, feedback with counter, **Save grade**, then **Release** (confirm "Students will see this grade; it cannot be changed"). Status badge Not graded / Graded (not released) / Released. Server errors shown in an alert. **Release** is disabled with "Available after the due date" until the due date has passed (the API decides, G3a). |
| Home — course card (Student) | New button **"My grades"**. |
| My grades (Student) | Loading / empty ("No released grades yet") / error states. Table: milestone, version, score / max, weight, feedback, release date. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-06-01 | Given the course instructor and a team's current submission, when they save a valid score and feedback, then 200 and the grade is stored with grader and time, unreleased. Saving again before release updates it. | FR-17 |
| AC-06-02 | Score below 0, above `maxScore`, not an integer or missing, or missing / blank / > 2000-char feedback → 400 naming the field; nothing stored or changed. Score 0 and score = `maxScore` are accepted. | BR-12, NFR-05 |
| AC-06-03 | Grading a version that is not the team's current version → 409 `NOT_CURRENT_VERSION`; nothing stored. | D-08 |
| AC-06-04 | After the due date, releasing a saved grade of the current version → 200 with `releasedAt`. Releasing without a grade → 409 `NOT_GRADED`; before or exactly at the due date → 409 `BEFORE_DUE` *(v1.1)*; a grade of a version that is no longer current → 409 `NOT_CURRENT_VERSION` *(v1.1)*; releasing again or editing a released grade → 409 `GRADE_RELEASED`. In every refused case the stored grade is unchanged. | FR-17, D-08 |
| AC-06-05 | A team member sees released grades of their own team with score, max score and feedback; an unreleased grade does not appear in any student response. | FR-18, BR-12 |
| AC-06-06 | After release (which is after the due date), the team cannot submit that milestone again (409 `GRADE_RELEASED`); before the due date resubmission stays possible (FR-16); lowering the milestone's `maxScore` below an existing score → 409 `SCORE_ABOVE_MAX`. | D-08, BR-12, FR-16 |
| AC-06-07 | A student cannot grade or release (403); an instructor of another course cannot grade, release or view (403); a student never receives another team's grade. | NFR-03 |
| AC-06-08 | All F-06 endpoints without a session → 401. | NFR-02 |
| AC-06-09 | UI journey: instructor1 grades Team Alpha's M1 (85 / 100, feedback), student1 sees no grade; instructor1 releases; student1 sees 85 / 100 and the feedback; student3 (Team Beta) sees none. | FR-17, FR-18, NFR-09 |
| AC-06-10 *(v1.1)* | Concurrent requests keep D-08: a submit of v2 running together with a grade of v1 never leaves a grade on a non-current version that can be released, and a `PUT` running together with a release never changes a released grade. | NFR-06, D-08 |

## 7. Software Test Specification

All API/DB tests create their own users, courses, teams and milestones in `beforeEach` *(v1.1)*; nothing depends on the seed.

| Test ID | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-06-01 | AC-06-02 | Unit | max 100: scores -1, 0, 100, 101, 85.5, `"85"`, missing; feedback `""`, `"  "`, 2000, 2001 chars | `validateGradeShape`, `checkScoreRange` | 0 and 100 ok; others rejected naming the field |
| TEST-06-02 | AC-06-03, AC-06-04 | Unit | combinations of current / not current, released / not, no grade, `now` = due − 1 ms / due / due + 1 ms *(v1.1)* | `canGrade`, `canRelease` | codes as in G2/G3 with the G3 check order; release refused at exactly the due date, allowed 1 ms later |
| TEST-06-03 | AC-06-05 | Unit | grades with and without `releasedAt` | `visibleToStudent` | only released |
| TEST-06-04 | AC-06-01 | API+DB | Alpha current v1 on M1 | instructor1 PUT 80; PUT 85 | 200 ×2; DB one grade, 85, `gradedById` = instructor1, `releasedAt` null |
| TEST-06-05 | AC-06-02 | API+DB | M1 max 100 | PUT -1, 101, 85.5, feedback `""`; PUT 0; PUT 100 | 400 ×4 with field, DB unchanged; 200; 200 |
| TEST-06-06 | AC-06-03 | API+DB | Alpha v1 and v2 on M1 | PUT on v1 | 409 `NOT_CURRENT_VERSION`; no grade row |
| TEST-06-07 | AC-06-04 | API+DB | M1 due in the future, v2 without grade *(v1.1)* | release; PUT 85; release (before due); set due to 1 min ago; release; release; PUT 90 | 409 `NOT_GRADED`; 200; 409 `BEFORE_DUE`; 200 `releasedAt`; 409 `GRADE_RELEASED`; 409, score still 85 |
| TEST-06-07b *(v1.1)* | AC-06-04 | API+DB | Alpha v1 graded (not released), then v2 submitted; due date passed | release the v1 grade | 409 `NOT_CURRENT_VERSION`; `releasedAt` still null |
| TEST-06-08 | AC-06-05 | API+DB | Alpha M1 released 85, M2 graded not released | student1 GET my-grades; student3 GET my-grades | Alpha: 1 grade (M1) only, body has no M2 score; Beta: empty |
| TEST-06-09 | AC-06-06 | API+DB | *(v1.1)* M1 due date passed; Alpha has only a **late** v1 (so BR-11 would still allow another late version), graded 85 and released | student1 POST submission on M1; instructor1 PATCH M1 `maxScore` 80; PATCH 90 | 409 `GRADE_RELEASED`, no new version; 409 `SCORE_ABOVE_MAX`; 200 |
| TEST-06-10 | AC-06-07 | API+DB | *(v1.1)* the test creates its own fixtures (as in F-04/F-05): instructor2 owning another course, student5 enrolled in CPE334 without a team (needs F-03 `Enrollment`, merged before F-06 starts); student1 | student1 PUT/release; instructor2 PUT/release/GET submissions; student5 (no team) GET my-grades | 403 ×5, no grade data; 409 `NO_TEAM` |
| TEST-06-11 | AC-06-08 | API | no cookie | each F-06 endpoint | 401 |
| TEST-06-12 | AC-06-09 | E2E (Playwright) | `cpms_e2e` with Alpha approved and M1 submitted | journey of AC-06-09 | each step visible; screenshots `evidence/screenshots/F06-*.png` |
| TEST-06-13 *(v1.1)* | AC-06-10 | API+DB | Alpha v1 on M1, due date passed for the release part | (a) 10 × in parallel: student1 POST v2 and instructor1 PUT grade on v1; (b) PUT 90 in parallel with release of a saved 85 | (a) every run ends in one of two states: grade on v1 stored **and** v2 exists → release of v1 gives 409 `NOT_CURRENT_VERSION`; or v2 first → PUT on v1 gives 409 `NOT_CURRENT_VERSION`. (b) the released score is the one stored before the release; the PUT either ran first (then the released score is 90) or got 409 `GRADE_RELEASED` |

## 8. Definition of Done (F-06 instance of the Product DoD)
- [ ] D-08 approved in the PR review and added to `docs/srs.md` §8 (baseline change recorded in Deliverable 2 Part A).
- [ ] AC-06-01 … AC-06-10 implemented.
- [ ] TEST-06-01 … TEST-06-11, TEST-06-07b and TEST-06-13 automated and passing in `npm test`; TEST-06-12 passing in `npm run test:e2e`.
- [ ] Red → green evidence in `docs/sprints/sprint-2/evidence/F-06-tdd-red.txt` and `F-06-tdd-green.txt`.
- [ ] F-01 … F-05 tests still pass; F-04 contract updated (G6 `SCORE_ABOVE_MAX`); F-05 contract S5 and its submit transaction use the same team lock (G8).
- [ ] Migration applies on a copy of the deployed database; no secrets in Git; README updated with the grading journey.
- [ ] PR into `sprint-2` reviewed and approved by jaruwan18 with a specific review comment; `Closes #43`.
- [ ] Contract version history updated if behaviour changes; known gaps disclosed in the PR and in Deliverable 2.

## 9. Known limitations
- No weighted course total is calculated (not in the baseline); F-08 shows released grades per milestone.
- Grade-release audit entries are F-09 (Sprint 3).
- A released grade cannot be corrected inside CPMS (D-08); a correction would need a new baseline decision.
