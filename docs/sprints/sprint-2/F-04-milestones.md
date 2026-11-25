# F-04 Course Milestones — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-04 Course Milestones |
| Sprint | 2 |
| GitHub Issue | #41 |
| Branch | `feature/F-04-milestones` (from `sprint-2`) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-13, FR-14, BR-09, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01 (`requireAuth`, `requireRole`, course ownership); F-03 `Enrollment` for student access (until F-03 is merged, a student's course access uses team membership as in F-01) |
| Used by | F-05 (submissions per milestone, due date), F-06 (`maxScore`), F-07 (rating per milestone), F-08 dashboard |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-24 | Film26 | Initial contract: design, API, data, UI, AC, STS, DoD | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md` and the F-01/F-02 code |
| 1.1 | 2026-11-24 | Film26 | TEST-04-09 split: the `NO_TEAM` case becomes TEST-04-09b and runs after F-03 is merged; migration name is `20261124164659_f04_milestones` | Writing the RED tests showed that a student "in the course without a team" cannot exist before F-03 adds `Enrollment`. Until then a student belongs to a course through a team (as in F-01). No AC changed |
| 1.2 | 2026-11-25 | Film26 | `dueAt` must be a date that exists (30 Feb, 31 Apr rejected); the seed adds milestones only to a course without milestones; edit and delete lock the milestone row inside their transaction and map Prisma P2025 to 404; new TEST-04-13, TEST-04-14, TEST-04-14b | PR #48 review by jaruwan18: impossible dates rolled over to the next month; re-running the seed on deploy could re-add a renamed or deleted milestone and exceed 100 %; a delete racing another request could end in 500 |
| 1.3 | 2026-11-25 | Film26 | M5 with F-03: a student must be **enrolled** in the course to list milestones (was: in a team of the course); without a team the list shows `NO_TEAM`. TEST-04-09b runs (was `it.todo`); the F-04 test fixture enrolls its students | F-03 adds `Enrollment` (planned in v1.1) |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement / rule |
|---|---|
| FR-13 | An Instructor can create, edit and delete milestones (title, description, due date, weight %) for their course. The feature inventory also lists a **max score**, used by F-06. |
| FR-14 | Students can view the milestones of their course with due dates and their team's submission status. |
| BR-09 | The sum of milestone weights in a course cannot exceed 100 %. |
| NFR-02 / NFR-03 | 401 without a session; 403 for a student writing, or an instructor of another course; no milestone data in the body. |
| NFR-05 / NFR-06 | One error shape; a rejected request changes nothing. |
| NFR-09 | Milestone screens have loading, empty and error states. |

## 2. Behaviour and workflow

```
 Instructor (course owner)                               Student (enrolled)
 ┌───────────────────────────────────────────────┐   ┌──────────────────────────────────────┐
 │ create ─► milestone (BR-09: total ≤ 100 %)    │   │ list milestones of the course        │
 │ edit   ─► fields changed (BR-09 rechecked)    │   │   due date, weight, max score,       │
 │ delete ─► removed (F-05: not if submissions)  │   │   team status NOT_SUBMITTED /        │
 │ list   ─► milestones + total weight           │   │   SUBMITTED / LATE (filled by F-05)  │
 └───────────────────────────────────────────────┘   └──────────────────────────────────────┘
```

### Business rules as implemented
- **M1 (BR-09)** Create and edit run in one transaction that locks the course row (`SELECT … FOR UPDATE`), sums the weights of the course's other milestones and rejects `sum + weight > 100` with `409 WEIGHT_EXCEEDED`, `details: { currentTotal, requested, max: 100 }`. Boundary: a total of exactly 100 is accepted. Two concurrent creates cannot both pass.
- **M2** Weight is an integer percentage 1–100 and max score an integer 1–1000 (integers avoid rounding errors in the BR-09 sum). Also DB `CHECK` constraints.
- **M3** A due date may be in the past (the instructor can record a milestone that already happened); the UI shows a warning. Due dates are stored in UTC and compared on the server clock by F-05.
- **M4 Delete.** `DELETE` removes a milestone that has no submissions → 204. *(v1.2)* Edit and delete load the milestone with `SELECT … FOR UPDATE` inside their transaction, so two requests on the same milestone run one after the other; the second gets 404 if the first deleted it (never 500). Once F-05 adds `Submission`, a milestone with submissions → `409 MILESTONE_HAS_SUBMISSIONS` (FK `ON DELETE RESTRICT`); recorded here so F-05 does not need a new rule.
- **M5 Ownership.** Create, edit, delete and the instructor list: role INSTRUCTOR **and** `course.instructorId = me`. Student list: role STUDENT **and** enrolled in the course. The course of a milestone always comes from the DB; a `courseId` in a PATCH body is ignored (a milestone cannot be moved).
- **M6 Team status (FR-14).** For a student the list adds `teamStatus` per milestone. In F-04 it is always `NOT_SUBMITTED`, or `NO_TEAM` when the student has no team. F-05 fills `SUBMITTED` / `LATE` from the current submission version.
- **M7** Sort order: `dueAt` ascending, then `id`.

### Validation
| Field | Rule | Error |
|---|---|---|
| `title` | required on create; string; trimmed; 1–120 chars | 400 `VALIDATION_ERROR`, `details.title` |
| `description` | optional; string; trimmed; 0–2000 chars (default `""`) | 400, `details.description` |
| `dueAt` | required on create; ISO 8601 date-time **with** offset or `Z` (e.g. `2026-12-05T23:59:00+07:00`); the calendar date must exist (no 30 Feb) *(v1.2)* | 400, `details.dueAt` |
| `weight` | required on create; integer 1–100 | 400, `details.weight` |
| `maxScore` | required on create; integer 1–1000 | 400, `details.maxScore` |
| PATCH body | at least one of the five fields, each validated as above | 400 `VALIDATION_ERROR` |
| path ids | positive integers | 400 |

Validation runs before any DB read, so a 400 never changes data.

## 3. API contract

All endpoints require a session (`401 UNAUTHENTICATED`). Order of checks: authenticate (401) → role (403) → validate (400) → load resource (404) → ownership/enrollment (403) → business rule (409) → write.

**Milestone object** (`M`): `{ id, courseId, title, description, dueAt, weight, maxScore, createdAt, updatedAt }`

| Method & path | Who (M5) | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/courses/:courseId/milestones` | INSTRUCTOR owner **or** STUDENT enrolled | — | Instructor: `200 { course: { id, code, name }, milestones: [M], totalWeight }`. Student: `200 { course, team: { id, name } \| null, milestones: [ M & { teamStatus } ], totalWeight }` | 400, 403, 404 |
| `POST /api/courses/:courseId/milestones` | INSTRUCTOR owner | `{ title, description?, dueAt, weight, maxScore }` | `201 { milestone: M }` | 400, 403, 404, 409 `WEIGHT_EXCEEDED` |
| `PATCH /api/milestones/:id` | INSTRUCTOR owner | any of the fields | `200 { milestone: M }` | 400, 403, 404, 409 `WEIGHT_EXCEEDED` (F-06 adds 409 `SCORE_ABOVE_MAX`) |
| `DELETE /api/milestones/:id` | INSTRUCTOR owner | — | `204` | 400, 403, 404 (F-05 adds 409 `MILESTONE_HAS_SUBMISSIONS`) |

### Application-layer components (server)
| Module | Responsibility |
|---|---|
| `src/milestones/rules.js` | Pure logic: `validateMilestoneInput(body, { partial })`, `parseDueAt`, `checkWeightTotal(otherTotal, weight)` → `{ ok, currentTotal }` |
| `src/milestones/service.js` | Course row lock + sum in one transaction, ownership/enrollment look-ups, team status (M6), response mapping |
| `src/routes/milestones.js` | `/api/milestones/:id` routes |
| `src/routes/courses.js` | adds `GET` and `POST /:courseId/milestones` (F-01/F-02 routes unchanged) |

## 4. Data

Migration `20261124164659_f04_milestones` *(v1.1)*:
- New `Milestone { id, courseId (FK Course, cascade), title, description @default(""), dueAt DateTime, weight Int, maxScore Int, createdAt, updatedAt }`, `@@index([courseId])`.
- SQL `CHECK ("weight" BETWEEN 1 AND 100)` and `CHECK ("maxScore" BETWEEN 1 AND 1000)`. Prisma does not model CHECK constraints and does not report them as drift.
- BR-09 (a sum over rows) is enforced by the M1 transaction, not by a constraint. Recorded as a known limitation.
- **Seed change:** CPE334 gets three milestones: "M1 Requirements" (weight 20, max 100, due 2026-12-01 23:59 Asia/Bangkok), "M2 Design" (30, 100, 2026-12-06 23:59), "M3 Final release" (40, 100, 2026-12-13 23:59). Total 90 %, so a 10 % milestone can still be added and an 11 % one is rejected. *(v1.2)* The seed runs on every deploy, so it adds these milestones **only when the course has no milestone at all** (`prisma/seedMilestones.js`); it never re-adds a milestone the instructor renamed or deleted.

## 5. UI
| Screen / element | Behaviour |
|---|---|
| Home — course card | INSTRUCTOR: new button **"Milestones"**. STUDENT: new button **"Milestones"**. Hidden buttons are convenience only. |
| Milestones (Instructor) | Loading / empty ("No milestones yet") / error states. Table: title, due date (Asia/Bangkok), weight, max score, **Edit**, **Delete** (confirm dialog). Total weight bar "90 / 100 %". **Add milestone** form with field errors before submit and a past-date warning. Server `WEIGHT_EXCEEDED` shown as "Total weight would be 101 % (max 100 %)". |
| Milestones (Student) | Loading / empty / error states. Table: title, due date, weight, max score, status badge (Not submitted / Submitted / Late, or "Join a team to submit"). Read-only. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-04-01 | Given the course instructor, when they create a milestone with valid fields, then 201 and one row is stored with the given values in UTC. | FR-13 |
| AC-04-02 | Missing or invalid title, description, `dueAt`, weight or max score (create or edit) → 400 `VALIDATION_ERROR` naming the field; nothing stored or changed. | FR-13, NFR-05 |
| AC-04-03 | Creating or editing so that the course total exceeds 100 % → 409 `WEIGHT_EXCEEDED` with the current total; nothing changed. A total of exactly 100 % is accepted. Two concurrent creates that together exceed 100 %: exactly one succeeds. | BR-09, NFR-06 |
| AC-04-04 | The instructor edits a milestone → 200 and only the sent fields change; editing its own weight does not count the old weight twice. | FR-13 |
| AC-04-05 | The instructor deletes a milestone without submissions → 204 and the row is gone; the freed weight can be used again. | FR-13 |
| AC-04-06 | The instructor lists milestones → sorted by due date, with `totalWeight`. An enrolled student lists them with `teamStatus` per milestone (`NOT_SUBMITTED`, or `NO_TEAM` without a team). Unknown course or milestone → 404. | FR-13, FR-14 |
| AC-04-07 | A student cannot create, edit or delete (403); an instructor of another course cannot list, create, edit or delete (403); a student not enrolled cannot list (403). No milestone data in the body; DB unchanged. | NFR-03 |
| AC-04-08 | All F-04 endpoints without a session → 401 `UNAUTHENTICATED`. | NFR-02 |
| AC-04-09 | UI journey: instructor1 adds "M4 Demo" (10 %), sees the total 100 %, tries to add a 1 % milestone and sees the weight error, edits M4's due date; student1 sees four milestones with "Not submitted". | FR-13, FR-14, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-04-01 | AC-04-02 | Unit | `{}`; blank title; 121-char title; 2001-char description; `dueAt` `"2026-12-01"` (no time/offset), `"tomorrow"`; weight 0, 101, 12.5, `"20"`; maxScore 0, 1001 | `validateMilestoneInput` | each error names the field; 1/100 and 1/1000 accepted (boundaries) |
| TEST-04-02 | AC-04-03 | Unit | other total 90 | `checkWeightTotal(90, 10)`, `(90, 11)`, `(0, 100)` | ok, not ok (`currentTotal` 90), ok |
| TEST-04-03 | AC-04-01 | API+DB | instructor1 owns CPE334 | POST valid milestone with `courseId: 999` in body | 201; DB row in CPE334 with `dueAt` as UTC |
| TEST-04-04 | AC-04-02 | API+DB | — | POST `{}`; POST weight 101; PATCH title `""` | 400 with the field in `details`; row count and stored title unchanged |
| TEST-04-05 | AC-04-03 | API+DB | seed total 90 | POST weight 11; POST weight 10; PATCH M1 weight 21 | 409 `WEIGHT_EXCEEDED` `currentTotal: 90`; 201 (total 100); 409; DB total 100 |
| TEST-04-06 | AC-04-03 | API+DB | course with total 50 | 2 concurrent POST weight 30 | one 201, one 409; DB total 80 |
| TEST-04-07 | AC-04-04 | API+DB | M1 weight 20, total 90 | PATCH M1 `{ weight: 30 }`; PATCH M1 `{ title: "M1 SRS" }` | 200 (total 100, not 120); 200 with only the title changed |
| TEST-04-08 | AC-04-05 | API+DB | total 90 | DELETE M3; POST weight 50 | 204, row gone; 201 |
| TEST-04-09 | AC-04-06 | API+DB | seed milestones (total 90) | instructor1 GET; student1 GET; GET unknown course; PATCH / DELETE unknown milestone; GET course `abc` | sorted M1, M2, M3, `totalWeight` 90; `team` Alpha and `teamStatus` `NOT_SUBMITTED` ×3; 404; 404; 400 |
| TEST-04-09b *(v1.1)* | AC-04-06 | API+DB | after F-03: student5 enrolled, no team | student5 GET | `team: null`, `teamStatus` `NO_TEAM` ×3 (`it.todo` until F-03 is merged) |
| TEST-04-10 | AC-04-07 | API+DB | instructor2 owns another course; student7 not enrolled | student1 POST/PATCH/DELETE; instructor2 GET/POST/PATCH/DELETE; student7 GET | all 403 `FORBIDDEN`, no `milestone(s)` in body; DB unchanged |
| TEST-04-11 | AC-04-08 | API | no cookie | each F-04 endpoint | 401 |
| TEST-04-12 | AC-04-09 | E2E (Playwright) | `cpms_e2e` seeded | journey of AC-04-09 | each step visible; screenshots `evidence/screenshots/F04-*.png` |
| TEST-04-13 *(v1.2)* | AC-04-03 | API+DB | course without milestones; then M1 renamed and a 10 % milestone added; then M2 deleted | `seedMilestones` three times | 3 created (90 %); then 0 created, total 100 %; then 0 created, total 70 % |
| TEST-04-14 *(v1.2)* | AC-04-05, NFR-05 | API+DB | M1 | two DELETE of M1 at the same time | statuses 204 and 404, never 500 |
| TEST-04-14b *(v1.2)* | AC-04-04, NFR-05 | API+DB | M2 | PATCH and DELETE of M2 at the same time | DELETE 204; PATCH 200 or 404, never 500 |

## 8. Definition of Done (F-04 instance of the Product DoD)
- [ ] AC-04-01 … AC-04-09 implemented.
- [ ] TEST-04-01 … TEST-04-11, TEST-04-13, TEST-04-14, TEST-04-14b *(v1.2)* automated and passing in `npm test`; TEST-04-09b passing once F-03 is merged; TEST-04-12 passing in `npm run test:e2e`.
- [ ] Red → green evidence in `docs/sprints/sprint-2/evidence/F-04-tdd-red.txt` and `F-04-tdd-green.txt`.
- [ ] F-01, F-02 (and F-03 if merged first) tests still pass.
- [ ] Migration applies on a copy of the deployed database; no secrets in Git; README updated with the milestone journey.
- [ ] PR into `sprint-2` reviewed and approved by jaruwan18 with a specific review comment; `Closes #41`.
- [ ] Contract version history updated if behaviour changes; known gaps disclosed in the PR and in Deliverable 2.

## 9. Known limitations
- BR-09 is guarded by a transaction with a course row lock, not a DB constraint (see §4).
- `teamStatus` is always `NOT_SUBMITTED` / `NO_TEAM` until F-05 is merged.
- Changing `dueAt` after submissions exist does not recompute earlier `LATE` flags (F-05 stores the flag at submission time). To be reviewed in F-05.
