# F-05 Deliverable Submission — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-05 Deliverable Submission |
| Sprint | 2 |
| GitHub Issue | #42 |
| Branch | `feature/F-05-submissions` (from `sprint-2`, after F-03 and F-04 are merged) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-15, FR-16, FR-14 (status part), BR-10, BR-11, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01; F-02 (`APPROVED` proposal, BR-10); F-03 (`Enrollment`, team membership); F-04 (`Milestone.dueAt`, `teamStatus`) |
| Used by | F-06 (grades a submission), F-08 dashboard (submissions, late count) |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-24 | Film26 | Initial contract: design, API, data, UI, AC, STS, DoD | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md`, F-02 and the F-03/F-04 contracts |
| 1.1 | 2026-11-25 | Film26 | Migration name `20261125120000_f05_submissions`; TEST-05-13 already passes at RED because F-04 maps the FK error to 409 `MILESTONE_HAS_SUBMISSIONS` (M4) | Recorded while writing the RED tests. No AC changed |
| 1.2 | 2026-11-25 | Film26 | Owner changes to Film26 (plan v0.4); S5 note: checked after S1 and before S3 inside the team-row lock (F-06 G8); a student without a team can still open the page (`team: null`, no form) | PR #47 review (F-06 G8) and the owner change |
| 1.3 | 2026-11-25 | Film26 | S5 implemented: a released grade on the milestone → 409 `GRADE_RELEASED`, checked inside the team-row lock after BR-10 and before S3; the instructor view adds each team's `grade` | F-06 (PR #47) |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement / rule |
|---|---|
| FR-15 | A team member can submit a deliverable (URL + note) for a milestone. |
| FR-16 | A team can resubmit before the due date; the latest version is current and previous versions are kept. |
| FR-14 | Students see their team's submission status per milestone (F-04 list, status filled here). |
| BR-10 | Only a team with an `APPROVED` proposal can submit milestone deliverables. |
| BR-11 | A submission after the milestone due date is accepted but marked `LATE`; resubmission after the due date is not allowed once a non-late version exists. |
| NFR-02 / NFR-03 / NFR-05 / NFR-06 / NFR-09 | 401, 403 without data, one error shape, no partial data, loading/empty/error states. |

## 2. Behaviour and workflow

```
 Team member (team has APPROVED proposal)                       Instructor (course owner)
 ┌──────────────────────────────────────────────────────────┐  ┌──────────────────────────────┐
 │ now ≤ dueAt : submit / resubmit ─► v1, v2 … (on time)    │  │ list per team: current       │
 │ now > dueAt : no on-time version ─► vN marked LATE       │  │ version, LATE flag, count    │
 │               on-time version exists ─► 409 (BR-11)      │  │ open any version's URL       │
 │ view own team's versions, current = highest version      │  └──────────────────────────────┘
 └──────────────────────────────────────────────────────────┘
```

### Business rules as implemented
- **S1 (BR-10)** Submit requires that the team has a proposal with status `APPROVED`; otherwise `409 PROPOSAL_NOT_APPROVED`.
- **S2 (BR-11, late flag)** `isLate = now > milestone.dueAt` (server clock), stored on the version at submission time. Boundary: submitting exactly at `dueAt` is on time (same rule as BR-02).
- **S3 (BR-11, resubmission)** When `now > dueAt` and the team already has a version with `isLate = false` → `409 RESUBMISSION_CLOSED`. When all earlier versions are late (or there are none), a late version is accepted. Before the due date resubmission is always allowed (FR-16).
- **S4 (FR-16, versions)** Submit runs in one transaction that locks the team row, reads the highest version for (milestone, team) and inserts `version = max + 1`. DB unique `(milestoneId, teamId, version)` backs this up. Earlier versions are never changed or deleted. The **current** version is the highest one.
- **S5 (BR-12 link)** When F-06 has released a grade for the team's current version of this milestone, a new submission → `409 GRADE_RELEASED` (decision D-08 in F-06; checked here once F-06 is merged). Checked after S1 (BR-10) and before S3, inside the same team-row lock as S4, which F-06 grade and release also take (F-06 G8). Because F-06 releases a grade only after the due date (F-06 G3a), S5 never blocks a resubmission before the due date (FR-16).
- **S6 Ownership.** Submit and the student view: role STUDENT **and** member of a team in the milestone's course; the team is the student's own team (from the session, never from the body). Instructor view: role INSTRUCTOR **and** owns the course. A student without a team → `409 NO_TEAM`.
- **S7 Status for FR-14.** F-04 `teamStatus` becomes `SUBMITTED` (current version on time), `LATE` (current version late) or `NOT_SUBMITTED`.
- **S8** Milestone delete (F-04 M4) is blocked by FK `ON DELETE RESTRICT` → `409 MILESTONE_HAS_SUBMISSIONS`.

### Validation
| Field | Rule | Error |
|---|---|---|
| `url` | required; string; trimmed; 1–2000 chars; parses with `new URL()` and protocol is `http:` or `https:` | 400 `VALIDATION_ERROR`, `details.url` |
| `note` | optional; string; trimmed; 0–1000 chars (default `""`) | 400, `details.note` |
| path ids | positive integers | 400 |

## 3. API contract

All endpoints require a session (`401 UNAUTHENTICATED`). Order of checks: authenticate (401) → role (403) → validate (400) → load milestone (404) → enrollment/team/ownership (403) → business rule (409) → write.

**Submission object** (`S`): `{ id, milestoneId, teamId, version, url, note, isLate, submittedAt, submittedBy: { id, displayName } }`

| Method & path | Who (S6) | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/milestones/:id/submissions` | STUDENT, member of a team in the course | `{ url, note? }` | `201 { submission: S }` | 400, 403, 404, 409 `NO_TEAM`, `PROPOSAL_NOT_APPROVED`, `RESUBMISSION_CLOSED`, (`GRADE_RELEASED` after F-06) |
| `GET /api/milestones/:id/submissions` | STUDENT enrolled **or** INSTRUCTOR owner | — | Student: `200 { milestone: M, team: { id, name } \| null, current: S \| null, versions: [S] }` (newest first, own team only). Instructor: `200 { milestone: M, teams: [ { team: { id, name }, current: S \| null, versionCount } ] }` (all teams of the course, sorted by name) | 400, 403, 404 |
| `GET /api/courses/:courseId/milestones` *(changed)* | as F-04 | — | student `teamStatus` per S7 | as F-04 |
| `DELETE /api/milestones/:id` *(changed)* | as F-04 | — | as F-04 | + 409 `MILESTONE_HAS_SUBMISSIONS` |

### Application-layer components (server)
| Module | Responsibility |
|---|---|
| `src/submissions/rules.js` | Pure logic: `validateSubmissionInput(body)`, `isLate(dueAt, now)`, `canSubmit({ versions, dueAt, now })` → `{ ok, code? }`, `currentVersion(versions)`, `teamStatus(current)` |
| `src/submissions/service.js` | Team row lock, version numbering, BR-10 look-up, response mapping |
| `src/routes/milestones.js` | adds `POST` / `GET /api/milestones/:id/submissions` |

## 4. Data

Migration `20261125120000_f05_submissions` *(v1.1)*:
- New `Submission { id, milestoneId (FK Milestone, **restrict**), teamId (FK Team, cascade), version Int, url, note @default(""), isLate Boolean, submittedById (FK User), submittedAt DateTime @default(now()) }`.
- `@@unique([milestoneId, teamId, version])`, `@@index([teamId])`; SQL `CHECK ("version" >= 1)`.
- No seed submissions (tests create their own). The seed gives Team Alpha an `APPROVED` proposal only in the E2E/UAT reset script, not in the base seed, so the F-02 journeys still start from an empty state.

## 5. UI
| Screen / element | Behaviour |
|---|---|
| Milestones (Student) | Each row gets **Submit** / **Resubmit** (opens the submission page). Status badge from S7. |
| Milestone submission (Student) | Loading / error states. Shows due date and "On time until …" or "Past due: this version will be marked LATE". Form: URL (field error before submit), note with counter. Version history: version, time, LATE badge, link (opens in a new tab with `rel="noopener noreferrer"`), submitter. Server errors (`PROPOSAL_NOT_APPROVED` → "Your proposal must be approved before you can submit", `RESUBMISSION_CLOSED`, `NO_TEAM`) in an alert. Empty: "No submission yet". |
| Milestones (Instructor) | Each row gets **Submissions**: table per team with current version, time, LATE badge, link, number of versions; "Not submitted" for teams without one. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-05-01 | Given a member of a team with an `APPROVED` proposal, before the due date, when they submit a valid URL and note, then 201, version 1, `isLate = false`, and one row is stored for **their** team. | FR-15 |
| AC-05-02 | Missing, blank, non-http(s) (`javascript:`, `ftp:`), unparsable or > 2000-char URL, or > 1000-char note → 400 naming the field; nothing stored. | FR-15, NFR-05 |
| AC-05-03 | A team without an `APPROVED` proposal (none, `DRAFT`, `SUBMITTED` or only `REJECTED`) → 409 `PROPOSAL_NOT_APPROVED`; nothing stored. | BR-10, NFR-06 |
| AC-05-04 | Before (or exactly at) the due date, a resubmission creates version n+1; earlier versions are unchanged; the newest is `current`. Two concurrent submissions get versions n+1 and n+2 (no duplicate). | FR-16, NFR-06 |
| AC-05-05 | After the due date, with no earlier version, a submission is accepted and stored with `isLate = true`. | BR-11 |
| AC-05-06 | After the due date, when an on-time version exists → 409 `RESUBMISSION_CLOSED`; when only late versions exist, another late version is accepted. | BR-11 |
| AC-05-07 | The student milestone list shows `SUBMITTED`, `LATE` or `NOT_SUBMITTED` from the current version. The student view lists only their own team's versions; the instructor view lists every team of the course with its current version and count. | FR-14, FR-16 |
| AC-05-08 | An instructor cannot submit (403). A student of another course cannot submit or view (403). A student without a team → 409 `NO_TEAM`. A student never sees another team's versions. An instructor of another course cannot view (403). | NFR-03 |
| AC-05-09 | Deleting a milestone that has submissions → 409 `MILESTONE_HAS_SUBMISSIONS`; milestone and submissions kept. | FR-13, NFR-06 |
| AC-05-10 | All F-05 endpoints without a session → 401. | NFR-02 |
| AC-05-11 | UI journey: Team Alpha's proposal is approved; student1 submits a URL for M1; student2 resubmits; both see v2 current and v1 in the history; instructor1 sees Team Alpha "Submitted v2" and Team Beta "Not submitted". | FR-15, FR-16, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-05-01 | AC-05-02 | Unit | URLs `""`, `"  "`, `"github.com/x"`, `"javascript:alert(1)"`, `"ftp://x"`, 2000 and 2001 chars, `" https://github.com/x "`; note 1000 / 1001 | `validateSubmissionInput` | errors name the field; trimmed https URL accepted; 2000/1000 accepted, 2001/1001 rejected |
| TEST-05-02 | AC-05-04, AC-05-05 | Unit | due `D` | `isLate(D, D-1ms)`, `(D, D)`, `(D, D+1ms)` | false, **false (boundary)**, true |
| TEST-05-03 | AC-05-06 | Unit | versions `[]`, `[onTime]`, `[late]`, `[late, late]` × now before / after `D` | `canSubmit` | before: always ok. After: ok, `RESUBMISSION_CLOSED`, ok, ok |
| TEST-05-04 | AC-05-07 | Unit | current null / on time / late | `teamStatus` | `NOT_SUBMITTED`, `SUBMITTED`, `LATE` |
| TEST-05-05 | AC-05-01 | API+DB | Alpha APPROVED; M1 due in the future | student1 POST `{ url, note, teamId: beta, isLate: true }` | 201, version 1, `isLate` false, team Alpha; 1 row (body fields ignored) |
| TEST-05-06 | AC-05-02 | API+DB | Alpha APPROVED | POST `{}`, `javascript:` URL, 1001-char note | 400 ×3 with field; 0 rows |
| TEST-05-07 | AC-05-03 | API+DB | Alpha with no proposal; DRAFT; SUBMITTED; REJECTED only | POST valid | 409 `PROPOSAL_NOT_APPROVED` ×4; 0 rows |
| TEST-05-08 | AC-05-04 | API+DB | Alpha APPROVED, v1 exists | student2 POST; then 2 concurrent POST | 201 v2, v1 unchanged; versions 3 and 4, 4 rows, no duplicate |
| TEST-05-09 | AC-05-05 | API+DB | milestone due 1 minute ago, no versions | POST | 201 `isLate: true` |
| TEST-05-10 | AC-05-06 | API+DB | due date set in the DB to 1 min ago after an on-time v1; second milestone with only a late v1 | POST on each | 409 `RESUBMISSION_CLOSED`, still 1 row; 201 v2 `isLate: true` |
| TEST-05-11 | AC-05-07 | API+DB | Alpha current on time on M1, late on M2; Beta none | student1 GET milestones; student1 GET M1 submissions; instructor1 GET M1 submissions | `SUBMITTED`, `LATE`, `NOT_SUBMITTED`; versions of Alpha only, newest first; teams Alpha (current v, count) and Beta (null, 0) |
| TEST-05-12 | AC-05-08 | API+DB | instructor1; student7 not enrolled; student5 no team; student3 (Beta); instructor2 | instructor1 POST; student7 POST/GET; student5 POST; student3 GET M1 submissions; instructor2 GET | 403; 403/403; 409 `NO_TEAM`; 200 with Beta only (no Alpha URL in body); 403 |
| TEST-05-13 | AC-05-09 | API+DB | M1 with a submission | instructor1 DELETE M1 | 409 `MILESTONE_HAS_SUBMISSIONS`; rows kept |
| TEST-05-14 | AC-05-10 | API | no cookie | each F-05 endpoint | 401 |
| TEST-05-15 | AC-05-11 | E2E (Playwright) | `cpms_e2e`, Alpha proposal approved in setup | journey of AC-05-11 | each step visible; screenshots `evidence/screenshots/F05-*.png` |

## 8. Definition of Done (F-05 instance of the Product DoD)
- [ ] AC-05-01 … AC-05-11 implemented.
- [ ] TEST-05-01 … TEST-05-14 automated and passing in `npm test`; TEST-05-15 passing in `npm run test:e2e`.
- [ ] Red → green evidence in `docs/sprints/sprint-2/evidence/F-05-tdd-red.txt` and `F-05-tdd-green.txt`.
- [ ] F-01 … F-04 tests still pass; F-04 contract updated (M4, `teamStatus`).
- [ ] Migration applies on a copy of the deployed database; no secrets in Git; README updated with the submission journey.
- [ ] PR into `sprint-2` reviewed and approved by jaruwan18 with a specific review comment; `Closes #42`.
- [ ] Contract version history updated if behaviour changes; known gaps disclosed in the PR and in Deliverable 2.

## 9. Known limitations
- CPMS does not open or check the submitted URL (A-05, D-06).
- `isLate` is stored at submission time; moving a milestone's due date later does not change it (see F-04 §9).
- No per-version note editing or deletion (versions are an append-only history).
