# F-02 Project Proposal Workflow — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-02 Project Proposal Workflow |
| Sprint | 1 |
| GitHub Issue | #2 |
| Branch | `feature/F-02-proposal` (from `sprint-1`, after F-01 / PR #3) |
| Owner / reviewer | jaruwan18 / Film26 |
| Linked requirements | FR-05, FR-06, FR-07, FR-08, FR-09, BR-01, BR-02, BR-03, BR-04, BR-05, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01 (`requireAuth`, `requireRole`, current user from session); baseline tables `Course`, `Team`, `TeamMember`, `Proposal` |
| Used by | F-03 (BR-08 membership lock), F-05 (BR-10 only approved teams submit), F-08 dashboard, F-09 audit |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-07 | jaruwan18 | Initial contract: design, API, data, UI, AC, STS, DoD | Written before tests and implementation |
| 1.1 | 2026-11-07 | jaruwan18 | Order of checks: role (403) is checked by `requireRole` **before** input validation (400); review list opens on the "Submitted" filter | Reuses the F-01 `requireRole` middleware as planned in the F-01 contract; no AC or test changed (every AC-02 test uses a valid body for forbidden-role calls). Instructors mostly need the submitted queue |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement / rule |
|---|---|
| FR-05 | A Student can create and edit a **draft** proposal (title, description) for their own team. |
| FR-06 | A Student can submit their team's draft proposal; its status becomes `SUBMITTED` and the submission time is recorded. |
| FR-07 | An Instructor can list the proposals of a course they teach, filtered by status. |
| FR-08 | An Instructor can approve or reject a submitted proposal; a rejection includes a reason; the decision time and decider are recorded. |
| FR-09 | Team members can view their team's proposal, its status and the decision/reason. |
| BR-01 | A team has at most **one active proposal** (`DRAFT`, `SUBMITTED` or `APPROVED`). A new proposal may be created only after the previous one was `REJECTED`. |
| BR-02 | A proposal cannot be submitted after the course's `proposalDeadline` (server time). |
| BR-03 | Allowed transitions: `DRAFT→SUBMITTED` (team member), `SUBMITTED→APPROVED`, `SUBMITTED→REJECTED` (course instructor). Any other transition is rejected; `APPROVED` and `REJECTED` are final. |
| BR-04 | Rejecting requires a non-empty reason of at most 500 characters. |
| BR-05 | Only members of a team may create, edit, submit or read that team's proposal; only the course's instructor may decide on it. |
| NFR-02 / NFR-03 | Unauthenticated → 401; forbidden role/ownership → 403; neither returns proposal data. |
| NFR-05 | Errors use `{error:{code,message,details?}}`. |
| NFR-06 | A rejected request never leaves partial data (checked in the DB after every negative API test). |
| NFR-09 | Proposal screens have loading, empty and error states. |

## 2. Behaviour and workflow

```
            Student (team member)                           Instructor (course owner)
 ┌──────────────────────────────────────────┐      ┌───────────────────────────────────────┐
 │ create (BR-01) ─► DRAFT ◄─ edit (PATCH)  │      │                                       │
 │                    │                     │      │                                       │
 │        submit (BR-02 deadline, BR-03)    │      │                                       │
 │                    ▼                     │      │                                       │
 │                SUBMITTED ────────────────┼──────┼─► approve ─► APPROVED (final)         │
 │                                          │      │─► reject + reason (BR-04) ─► REJECTED │
 │ view status / decision / reason (FR-09)  │      │       (final; team may create a new   │
 └──────────────────────────────────────────┘      │        proposal — BR-01, D-05)        │
                                                   └───────────────────────────────────────┘
```

State machine (BR-03). Any pair not listed is rejected with `409 INVALID_TRANSITION`:

| From \ To | SUBMITTED | APPROVED | REJECTED |
|---|---|---|---|
| DRAFT | ✔ member, before deadline | ✘ | ✘ |
| SUBMITTED | ✘ | ✔ course instructor | ✔ course instructor + reason |
| APPROVED | ✘ | ✘ | ✘ |
| REJECTED | ✘ | ✘ | ✘ |

### Business rules as implemented
- **P1 (BR-01)** Create is rejected with `409 ACTIVE_PROPOSAL_EXISTS` when the team already has a `DRAFT`, `SUBMITTED` or `APPROVED` proposal. The check and the insert run in one DB transaction that first locks the team row (`SELECT … FOR UPDATE`), so two concurrent creates cannot both succeed. Rejected proposals are kept (history, D-05).
- **P2 (BR-02)** Submit is allowed while `now <= proposalDeadline`; `now > proposalDeadline` → `409 DEADLINE_PASSED`. **Boundary:** submitting exactly at the deadline is accepted. Server clock only; the client sends no time.
- **P3 (BR-03)** Each transition is a conditional update (`UPDATE … WHERE id = ? AND status = <expected>`). If no row changed, the request returns `409 INVALID_TRANSITION` and nothing is written.
- **P4 (FR-05)** Only a `DRAFT` may be edited; editing any other status → `409 INVALID_TRANSITION`.
- **P5 (FR-06, FR-08)** Submit sets `submittedAt = now`. Approve/reject sets `decidedAt = now`, `decidedById = current user`; reject also stores `rejectReason`.
- **P6 (BR-05)** Ownership:
  - create / edit / submit: role STUDENT **and** member of the proposal's team. Instructor → 403 (role). Student of another team → 403.
  - read one proposal: team member **or** instructor of the team's course; anyone else → 403.
  - list course proposals, approve, reject: role INSTRUCTOR **and** `course.instructorId = me`. Student → 403; other instructor → 403.
  - The acting user always comes from the session (`req.user`); `teamId`/`status`/`decidedById` sent in a body are ignored.
- **P7** Existence before permission: unknown course / team / proposal id → `404 NOT_FOUND`; non-integer id → `400 VALIDATION_ERROR`.

### Validation
| Field | Rule | Error |
|---|---|---|
| `title` | required on create; string; trimmed; 1–120 chars | 400 `VALIDATION_ERROR`, `details.title` |
| `description` | required on create; string; trimmed; 1–5000 chars | 400 `VALIDATION_ERROR`, `details.description` |
| PATCH body | at least one of `title`, `description`; each validated as above | 400 `VALIDATION_ERROR` |
| `reason` (reject) | required; string; trimmed; 1–500 chars (BR-04) | 400 `VALIDATION_ERROR`, `details.reason` |
| `status` query | optional; one of `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED` | 400 `VALIDATION_ERROR`, `details.status` |
| path ids | positive integers | 400 `VALIDATION_ERROR` |

Validation runs before any database read or rule check, so a 400 never changes data.

## 3. API contract

All errors use `{ "error": { "code", "message", "details"? } }`. All endpoints require a session (`401 UNAUTHENTICATED` otherwise).

**Proposal object** (`P`): `{ id, teamId, title, description, status, rejectReason, submittedAt, decidedAt, decidedBy: { id, displayName } | null, createdAt, updatedAt }`

| Method & path | Who (P6) | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/courses/:courseId/my-team` | STUDENT, member of a team in the course | — | `200 { course: { id, code, name, proposalDeadline }, team: { id, name, members: [ { id, displayName } ] }, proposals: [P] }` — newest first | 400, 403 (instructor), 404 (unknown course, or no team in this course) |
| `POST /api/teams/:teamId/proposals` | STUDENT, team member | `{ title, description }` | `201 { proposal: P }` with `status: "DRAFT"` | 400, 403, 404, 409 `ACTIVE_PROPOSAL_EXISTS` |
| `GET /api/proposals/:id` | team member or course instructor | — | `200 { proposal: P, team: { id, name }, course: { id, code } }` | 400, 403, 404 |
| `PATCH /api/proposals/:id` | STUDENT, team member | `{ title?, description? }` | `200 { proposal: P }` | 400, 403, 404, 409 `INVALID_TRANSITION` (not DRAFT) |
| `POST /api/proposals/:id/submit` | STUDENT, team member | — | `200 { proposal: P }` with `SUBMITTED`, `submittedAt` set | 403, 404, 409 `DEADLINE_PASSED`, 409 `INVALID_TRANSITION` |
| `GET /api/courses/:courseId/proposals?status=` | INSTRUCTOR, owns course | optional `status` | `200 { course: { id, code, name, proposalDeadline }, proposals: [ P & { team: { id, name } } ] }` — sorted by team name, newest first | 400, 403, 404 |
| `POST /api/proposals/:id/approve` | INSTRUCTOR, owns course | — | `200 { proposal: P }` with `APPROVED`, `decidedAt`, `decidedBy` | 403, 404, 409 `INVALID_TRANSITION` |
| `POST /api/proposals/:id/reject` | INSTRUCTOR, owns course | `{ reason }` | `200 { proposal: P }` with `REJECTED`, `rejectReason`, `decidedAt`, `decidedBy` | 400, 403, 404, 409 `INVALID_TRANSITION` |

Order of checks per request *(v1.1)*: authenticate (401) → role via `requireRole` (403) → validate input (400) → load resource (404) → team/course ownership (403) → business rule (409) → write.

### Application-layer components (server)
| Module | Responsibility |
|---|---|
| `src/proposals/rules.js` | Pure domain logic, no DB: `ACTIVE_STATUSES`, `isActiveStatus`, `canTransition(from, to)`, `isBeforeDeadline(deadline, now)`, `validateProposalInput(body, { partial })`, `validateRejectReason(body)`, `parseStatusFilter(q)` |
| `src/proposals/service.js` | DB work with Prisma: transactions, team lock, conditional updates, ownership look-ups, response mapping |
| `src/routes/proposals.js` | `/api/proposals/:id…` and `/api/teams/:teamId/proposals` routes |
| `src/routes/courses.js` | adds `GET /:courseId/proposals` and `GET /:courseId/my-team` (F-01 routes unchanged) |

## 4. Data
- Uses `Proposal`, `Team`, `TeamMember`, `Course.proposalDeadline` from baseline migration `20261107000000_init`. **No new migration, no schema change.**
- `Proposal.status` enum `DRAFT | SUBMITTED | APPROVED | REJECTED` (default `DRAFT`); `rejectReason`, `submittedAt`, `decidedAt`, `decidedById` nullable; FK `teamId` (cascade), FK `decidedById → User`; index on `teamId`.
- BR-01 is enforced in a transaction with a team row lock (P1), not by a DB constraint: a partial unique index (`WHERE status <> 'REJECTED'`) cannot be expressed in the Prisma schema and would be reported as drift by `prisma migrate dev`. Recorded as a known limitation.
- Seed: unchanged (Team Alpha = student1 + student2, Team Beta = student3, CPE334 deadline 2026-12-31 23:59:59 Asia/Bangkok, no proposals).

## 5. UI
| Screen / element | Behaviour |
|---|---|
| Home — course card | STUDENT: button **"My team proposal"**. INSTRUCTOR: buttons **"View roster"** and **"Review proposals"**. Hidden buttons are convenience only — the API returns 403. |
| My team proposal (Student) | Loading state; shows team name, members, deadline (Asia/Bangkok). No active proposal → **create form** (title, description, field errors before submit). `DRAFT` → edit form with **Save draft** and **Submit proposal**. `SUBMITTED` → read-only "Waiting for instructor decision". `APPROVED` → read-only, green status. `REJECTED` → shows the reason and a create form for a new proposal. Earlier proposals listed under "History". Server errors (e.g. `DEADLINE_PASSED`, `ACTIVE_PROPOSAL_EXISTS`) shown in an alert. No team → "You are not in a team for this course." |
| Review proposals (Instructor) | Status filter (All / Draft / Submitted / Approved / Rejected), opens on **Submitted** *(v1.1)*; loading, empty ("No proposals"), error (403 "You do not have access to this course") states. Each row: team, title, status badge, submitted time. `SUBMITTED` rows have **Approve** and **Reject**; Reject opens a reason text area (required, ≤ 500 chars, counter) and **Confirm reject**. List refreshes after a decision. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-02-01 | Given a student in a team without an active proposal, when they POST a valid title/description, then 201 with a `DRAFT` proposal for **their** team and one row is stored. | FR-05 |
| AC-02-02 | Given the team already has a `DRAFT`, `SUBMITTED` or `APPROVED` proposal, when a member creates another, then 409 `ACTIVE_PROPOSAL_EXISTS` and no new row is stored. After the active one is `REJECTED`, creating a new proposal succeeds and the rejected one is kept. | BR-01, NFR-06 |
| AC-02-03 | Missing/empty/too-long title or description (create or edit) → 400 `VALIDATION_ERROR` naming the field; no row created or changed. | FR-05, NFR-05 |
| AC-02-04 | A member can edit a `DRAFT`; editing a `SUBMITTED`/`APPROVED`/`REJECTED` proposal → 409 `INVALID_TRANSITION` and the stored text is unchanged. | FR-05, BR-03 |
| AC-02-05 | Before (or exactly at) the deadline, a member submits a `DRAFT` → 200, `SUBMITTED`, `submittedAt` stored. | FR-06, BR-02 |
| AC-02-06 | After the course deadline, submit → 409 `DEADLINE_PASSED`; the proposal stays `DRAFT` with `submittedAt = null`. | BR-02, NFR-06 |
| AC-02-07 | Transitions outside BR-03 (submit a non-draft; approve/reject a `DRAFT`, `APPROVED` or `REJECTED`) → 409 `INVALID_TRANSITION`; status unchanged. | BR-03 |
| AC-02-08 | The course instructor approves a `SUBMITTED` proposal → 200 `APPROVED`, `decidedAt` and `decidedBy` = that instructor are stored. | FR-08 |
| AC-02-09 | The course instructor rejects with a reason → 200 `REJECTED`, reason/decider/time stored. Missing, blank or > 500-char reason → 400 and the proposal stays `SUBMITTED`. | FR-08, BR-04 |
| AC-02-10 | A student who is not a member of the team cannot create, read, edit or submit that team's proposal (403, no proposal data). An instructor cannot create/edit/submit (403). | BR-05, NFR-03 |
| AC-02-11 | A student cannot list course proposals, approve or reject (403); an instructor of a **different** course cannot read, list, approve or reject (403); the proposal is unchanged. | BR-05, NFR-03 |
| AC-02-12 | All F-02 endpoints without a valid session → 401 `UNAUTHENTICATED`, no proposal data. | NFR-02 |
| AC-02-13 | Team members see their team, its proposals, status and the decision/reason via `GET /courses/:id/my-team` and `GET /proposals/:id`; the course instructor can list proposals filtered by status; an invalid status filter → 400; unknown ids → 404. | FR-07, FR-09 |
| AC-02-14 | UI journey: student creates and submits a proposal; instructor sees it under "Submitted", rejects it with a reason; the student sees `REJECTED` and the reason; the student creates a new proposal, submits it, and the instructor approves it; the student sees `APPROVED`. | FR-05–FR-09, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-02-01 | AC-02-07 | Unit | every (from, to) pair of the 4 statuses | `canTransition(from, to)` | true only for DRAFT→SUBMITTED, SUBMITTED→APPROVED, SUBMITTED→REJECTED |
| TEST-02-02 | AC-02-05, AC-02-06 | Unit | deadline `D` | `isBeforeDeadline(D, D-1ms)`, `(D, D)`, `(D, D+1ms)` | true, **true (boundary)**, false |
| TEST-02-03 | AC-02-02 | Unit | statuses | `isActiveStatus(s)` | DRAFT/SUBMITTED/APPROVED true; REJECTED false |
| TEST-02-04 | AC-02-03, AC-02-09 | Unit | inputs: `{}`, blanks, 121-char title, 5001-char description, reason `""`, `"  "`, 500 and 501 chars | `validateProposalInput`, `validateRejectReason` | errors name the right fields; trimmed values returned; 500 chars ok, 501 rejected |
| TEST-02-05 | AC-02-01 | API+DB | student1 in Team Alpha | POST `/teams/:alpha/proposals` with `teamId`/`status` in body as noise | 201, `DRAFT`, `teamId` = Alpha, 1 row in DB, `status` ignored |
| TEST-02-06 | AC-02-02 | API+DB | Alpha has a DRAFT; then SUBMITTED; then APPROVED (each set in DB) | POST create as student2 | 409 `ACTIVE_PROPOSAL_EXISTS` each time; row count unchanged |
| TEST-02-07 | AC-02-02 | API+DB | Alpha's only proposal is REJECTED | POST create | 201; DB holds 2 proposals (1 REJECTED, 1 DRAFT) |
| TEST-02-08 | AC-02-02, NFR-06 | API+DB | Alpha has no proposal | 5 concurrent POST create | exactly one 201, the rest 409; 1 row in DB |
| TEST-02-09 | AC-02-03 | API+DB | — | POST `{}`; POST blank title; PATCH draft with 121-char title | 400 `VALIDATION_ERROR` with `details.title`/`description`; DB unchanged |
| TEST-02-10 | AC-02-04 | API+DB | DRAFT, then SUBMITTED | PATCH title as member | 200 new title; then 409 `INVALID_TRANSITION`, title unchanged |
| TEST-02-11 | AC-02-05 | API+DB | DRAFT, deadline in the future | POST submit | 200 `SUBMITTED`, `submittedAt` stored |
| TEST-02-12 | AC-02-06 | API+DB | DRAFT, course deadline 1 minute in the past | POST submit | 409 `DEADLINE_PASSED`; DB still DRAFT, `submittedAt` null |
| TEST-02-13 | AC-02-07 | API+DB | SUBMITTED; DRAFT; APPROVED; REJECTED | submit again; approve DRAFT; reject APPROVED; approve REJECTED | 409 `INVALID_TRANSITION` each; status unchanged |
| TEST-02-14 | AC-02-08 | API+DB | SUBMITTED in instructor A's course | POST approve as A | 200 `APPROVED`; DB `decidedById` = A, `decidedAt` set |
| TEST-02-15 | AC-02-09 | API+DB | SUBMITTED | reject with no reason, `"   "`, 501 chars; then valid reason | 400 ×3 with DB still SUBMITTED; then 200 `REJECTED`, reason stored trimmed |
| TEST-02-16 | AC-02-10 | API+DB | Alpha DRAFT; student3 in Team Beta; instructor A | student3: create on Alpha, GET, PATCH, submit; A: create on Alpha, PATCH, submit | all 403 `FORBIDDEN`, no `proposal` in body; DB unchanged |
| TEST-02-17 | AC-02-11 | API+DB | SUBMITTED in A's course; instructor B owns another course | student1: list/approve/reject; B: GET, list, approve, reject | all 403; DB still SUBMITTED |
| TEST-02-18 | AC-02-12 | API | no cookie | call each F-02 endpoint | 401 `UNAUTHENTICATED`, no `proposal(s)` |
| TEST-02-19 | AC-02-13 | API+DB | Alpha: 1 REJECTED + 1 SUBMITTED; Beta: DRAFT | student1 GET my-team & GET proposal; A GET list, `?status=SUBMITTED`, `?status=BOGUS`; GET unknown proposal; student without team GET my-team | member sees team + 2 proposals newest first with reason; list returns 3 / filtered 1 with team names; 400; 404; 404 |
| TEST-02-20 | AC-02-14 | E2E (Playwright) | seeded DB (proposals of seeded course cleared at test start), API + UI running | student3 creates + submits → instructor1 rejects with reason → student3 sees reason, creates + submits new → instructor1 approves → student3 sees APPROVED | each step visible in the UI; screenshots saved to `evidence/screenshots/F02-*.png` |

## 8. Definition of Done (F-02 instance of the Product DoD)
- [ ] AC-02-01 … AC-02-14 implemented.
- [ ] TEST-02-01 … TEST-02-19 automated and passing in `npm test`; TEST-02-20 passing in `npm run test:e2e`.
- [ ] Red → green evidence kept in `docs/sprints/sprint-1/evidence/F-02-tdd-red.txt` and `F-02-tdd-green.txt` (tests committed before implementation).
- [ ] F-01 tests still pass (no regression).
- [ ] No schema change / migration; no secrets in Git; README updated with the proposal journey.
- [ ] PR into `sprint-1` reviewed and approved by Film26 with a specific review comment; Issue #2 linked (`Closes #2`).
- [ ] Contract version history updated if behaviour changes during implementation.
- [ ] Known gaps disclosed in the PR and in Deliverable Part F.

## 9. Known limitations
- BR-01 is guarded by a transaction + row lock, not a DB constraint (see §4).
- BR-07 (minimum team size before submit) and BR-08 (membership lock after approval) belong to F-03 in Sprint 2 and are not checked here.
- No audit log entry yet (FR-22 / F-09, Sprint 3); the decision fields on `Proposal` are the Sprint 1 record.
