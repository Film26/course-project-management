# F-09 Audit Log — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-09 Audit Log |
| Sprint | 3 |
| GitHub Issue | #46 |
| Branch | `feature/F-09-audit` (from `sprint-3`) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-22, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01; F-02 (proposal decisions, available now); F-03 (membership changes); F-06 (grade release) |
| Used by | Deliverable 2 Part C: the Sprint 3 workflow implemented and tested at this checkpoint (proposal decisions) |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-25 | Film26 | Initial contract: design, API, data, UI, AC, STS, DoD; delivery in three steps (A1–A3) | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md` and the F-02/F-03/F-06 contracts |
| 1.1 | 2026-11-25 | Film26 | L5: order and `before` cursor use the entry `id` only; new L6 names the exact call F-03 (A2) and F-06 (A3) make | PR #52 review by jaruwan18: `createdAt` is the transaction start time and can disagree with `id` order, so paging by `id` while sorting by `createdAt` could skip or repeat entries. PR #51 review: F-03 needs the exact hook |
| 1.2 | 2026-11-26 | Film26 | Steps A2 and A3 implemented as specified in L6 (no rule changed); TEST-09-10b added for the last member leaving an empty team (entry written before the team is deleted) | F-03 and F-06 are now in `sprint-3` (sync PR #61) |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement / rule |
|---|---|
| FR-22 | The system records an audit entry for proposal decisions, grade releases and team membership changes, viewable by the course instructor. |
| NFR-02 / NFR-03 | 401 without a session; only the course instructor reads the log (403 otherwise, no entries in the body). |
| NFR-05 / NFR-06 | One error shape; the change and its audit entry are written in **one** transaction: both or neither. |
| NFR-09 | The audit screen has loading, empty and error states. |

## 2. Behaviour

```
 proposal approve / reject ─┐
 team create / join / leave ─┼─► same DB transaction ─► change + AuditEntry (append-only)
 grade release              ─┘                                 │
                                         course instructor ◄───┘ GET /courses/:id/audit (newest first)
```

### Delivery steps (so that Sprint 3 progress is real and testable at Deliverable 2)
| Step | Actions recorded | Needs | Target |
|---|---|---|---|
| **A1** | `PROPOSAL_APPROVED`, `PROPOSAL_REJECTED` | F-02 (done) | Deliverable 2 candidate (29 Nov) |
| A2 | `TEAM_CREATED`, `MEMBER_JOINED`, `MEMBER_LEFT` | F-03 merged | done 26 Nov *(v1.2)* |
| A3 | `GRADE_RELEASED` | F-06 merged | done 26 Nov *(v1.2)* |

### Business rules as implemented
- **L1 Atomic.** Each recorded action writes its `AuditEntry` inside the same transaction as the change. If the audit insert fails, the change is rolled back (NFR-06). A request that is rejected (400/403/404/409) writes no entry.
- **L2 Append-only.** There is no endpoint to edit or delete entries. A DB trigger rejects `UPDATE` on `AuditEntry`. Entries are removed only when their course is deleted (cascade; not possible through the API).
- **L3 Content.** Each entry stores `action`, `actorId` (session user), `courseId`, `teamId` (when the action concerns a team), `entityId` (proposal / submission / team id) and `details` (JSON): proposal title and reject reason; team name; milestone title, score and max score. No passwords, tokens or e-mail addresses.
- **L4 Visibility.** Only the course instructor can read the course log. Students have no audit endpoint.
- **L5 Order and paging.** Newest first by `id` desc *(v1.1: id only, it follows insert order; `createdAt` is shown but not used for order)*. `limit` 1–100 (default 50); `before` = an entry id for the next page. Optional `action` filter.

- **L6 Hooks for A2 / A3 *(v1.1)*.** The feature that makes the change calls, **inside its own transaction**, `record(tx, { courseId, actorId: user.id, teamId, action, entityId, data })` from `src/audit/service.js`:
  - F-03 create team: `action: 'TEAM_CREATED'`, `entityId: team.id`, `data: { teamName }`; join: `'MEMBER_JOINED'`, `entityId: team.id`, `data: { teamName }`; leave: `'MEMBER_LEFT'`, `entityId: team.id`, `data: { teamName }`, recorded **before** an empty team is deleted (F-03 T6), so the name is kept.
  - F-06 release: `'GRADE_RELEASED'`, `entityId: submission.id`, `teamId`, `data: { milestoneTitle, score, maxScore }`.
  - `buildDetails` drops any other field (L3); a failed `record` rolls the change back (L1).

### Validation
| Field | Rule | Error |
|---|---|---|
| `limit` query | optional; integer 1–100 | 400 `VALIDATION_ERROR`, `details.limit` |
| `before` query | optional; positive integer | 400, `details.before` |
| `action` query | optional; one of the actions above | 400, `details.action` |
| path id | positive integer | 400 |

## 3. API contract

**Entry** (`A`): `{ id, action, createdAt, actor: { id, displayName }, team: { id, name } | null, entityId, details }`

| Method & path | Who | Request | Success | Errors |
|---|---|---|---|---|
| `GET /api/courses/:courseId/audit` | INSTRUCTOR, owns course | `?limit=&before=&action=` | `200 { course: { id, code, name }, entries: [A], nextBefore: id \| null }` | 400, 401, 403, 404 |
| `POST /api/proposals/:id/approve`, `/reject` *(changed, A1)* | as F-02 | as F-02 | as F-02, plus one entry | as F-02 |
| F-03 create / join / leave *(changed, A2)* | as F-03 | | plus one entry | as F-03 |
| F-06 release *(changed, A3)* | as F-06 | | plus one entry | as F-06 |

| Module | Responsibility |
|---|---|
| `src/audit/rules.js` | `ACTIONS`, `parseAuditQuery(query)`, `buildDetails(action, data)` (whitelists the stored fields, L3) |
| `src/audit/service.js` | `record(tx, entry)` used inside the callers' transactions; `listCourseAudit(courseId, user, query)` |
| `src/proposals/service.js` | `decideProposal` runs the conditional update and `record` in one `$transaction` (A1) |

## 4. Data

Migration `f09_audit_log`:
- `enum AuditAction { PROPOSAL_APPROVED PROPOSAL_REJECTED TEAM_CREATED MEMBER_JOINED MEMBER_LEFT GRADE_RELEASED }`
- `AuditEntry { id, courseId (FK Course, cascade), actorId (FK User), teamId Int? (no FK: the team may be deleted later, T6 of F-03), action AuditAction, entityId Int, details Json, createdAt }`, `@@index([courseId, createdAt])`.
- SQL trigger `audit_entry_no_update` raises an exception on `UPDATE` (L2).
- No seed entries.

## 5. UI
| Screen | Behaviour |
|---|---|
| Home — course card (Instructor) | New button **"Audit log"**. |
| Audit log (Instructor) | Loading / empty ("No activity yet") / error states. Table: time (Bangkok), actor, action label, team, summary (e.g. "Rejected 'Smart Parking': Too broad"). Filter by action. **Load more** while `nextBefore` is set. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-09-01 | When the course instructor approves a proposal, one `PROPOSAL_APPROVED` entry is stored with the instructor as actor, the team, the proposal id and title. | FR-22 |
| AC-09-02 | When the instructor rejects a proposal, one `PROPOSAL_REJECTED` entry is stored that also contains the reason. | FR-22 |
| AC-09-03 | A rejected decision request (400 blank reason, 403 other instructor, 404, 409 not `SUBMITTED`) stores no entry. | NFR-06 |
| AC-09-04 | If writing the entry fails, the decision is rolled back: the proposal stays `SUBMITTED`. | NFR-06 |
| AC-09-05 | The course instructor lists entries newest first, filtered by action, paged with `limit` and `before`; invalid query values → 400. | FR-22 |
| AC-09-06 | Students and instructors of other courses get 403 and no entries; no session → 401; unknown course → 404. | NFR-02, NFR-03 |
| AC-09-07 | An entry cannot be changed: an `UPDATE` on `AuditEntry` fails in the database. | FR-22 |
| AC-09-08 *(A2)* | Create, join and leave each store one entry with the team and the student as actor. | FR-22 |
| AC-09-09 *(A3)* | Releasing a grade stores one `GRADE_RELEASED` entry with milestone, score and max score. | FR-22 |
| AC-09-10 | UI: instructor1 rejects then approves proposals, opens **Audit log** and sees both entries, newest first, with the reason. | FR-22, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Input | Expected result |
|---|---|---|---|---|
| TEST-09-01 | AC-09-05 | Unit | `parseAuditQuery` with `{}`, `limit` 0/1/100/101/"x", `before` -1, `action` "BOGUS" | defaults `limit` 50; 1 and 100 ok; others rejected naming the field |
| TEST-09-02 | AC-09-01, AC-09-02 | Unit | `buildDetails` for each action with extra fields (email, passwordHash) | only the whitelisted fields are kept |
| TEST-09-03 | AC-09-01 | API+DB | SUBMITTED proposal; instructor1 approves | 200; exactly 1 entry `PROPOSAL_APPROVED`, actor instructor1, team Alpha, `entityId` = proposal id, `details.title` |
| TEST-09-04 | AC-09-02 | API+DB | SUBMITTED; reject with "Too broad" | 1 entry `PROPOSAL_REJECTED`, `details.reason` = "Too broad" |
| TEST-09-05 | AC-09-03 | API+DB | reject blank; approve as instructor2; approve unknown id; approve a DRAFT | 400, 403, 404, 409; 0 entries |
| TEST-09-06 | AC-09-04 | API+DB | the audit insert is made to fail (test-only DB trigger on `AuditEntry` INSERT, dropped after the test) | approve → 500 `INTERNAL_ERROR`, proposal still `SUBMITTED`, `decidedAt` null, 0 entries |
| TEST-09-07 | AC-09-05 | API+DB | 3 approvals + 2 rejections in order | list returns 5 newest first; `?action=PROPOSAL_REJECTED` → 2; `?limit=2` → 2 + `nextBefore`; next page continues without overlap; `?limit=0` → 400 |
| TEST-09-08 | AC-09-06 | API+DB | student1; instructor2; no cookie; course 999999 | 403, 403 (no `entries` in body), 401, 404 |
| TEST-09-09 | AC-09-07 | DB | one entry | `prisma.$executeRaw UPDATE "AuditEntry" SET …` rejects; row unchanged |
| TEST-09-10 *(A2)* | AC-09-08 | API+DB | F-03 create, join, leave | 3 entries with the right actions and actors |
| TEST-09-11 *(A3)* | AC-09-09 | API+DB | F-06 release | 1 entry with milestone, score, maxScore |
| TEST-09-12 | AC-09-10 | E2E | `cpms_e2e` | journey of AC-09-10; screenshots `evidence/screenshots/F09-*.png` |

## 8. Definition of Done
- [ ] A1 (AC-09-01 … 07, AC-09-10) implemented and tested for the Deliverable 2 candidate; A2/A3 after F-03/F-06 are merged.
- [ ] TEST-09-01 … 09 (and 10/11 for A2/A3) pass in `npm test`; TEST-09-12 in `npm run test:e2e`.
- [ ] Red → green evidence in `docs/sprints/sprint-3/evidence/F-09-tdd-red.txt` / `F-09-tdd-green.txt`.
- [ ] F-01 … F-06 tests still pass; F-02 contract records the transaction change (v1.4 or next).
- [ ] PR into `sprint-3` reviewed by jaruwan18; `Closes #46` after A3.

## 9. Known limitations
- `teamId` has no FK, so an entry keeps the id of a team that was later deleted (the name is in `details`).
- No export of the log; no audit of milestone edits (not in FR-22).
