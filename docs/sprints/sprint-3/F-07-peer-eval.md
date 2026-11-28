# F-07 Peer Evaluation — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-07 Peer Evaluation |
| Sprint | 3 |
| GitHub Issue | #44 |
| Branch | `feature/F-07-peer-eval` (from `sprint-3`) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-19, FR-20, BR-13, NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 |
| Depends on | F-01; F-03 (team membership, `Enrollment`); F-04 (`Milestone`) |
| Used by | — |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-25 | Film26 | Initial contract: design, API, data, UI, AC, STS, DoD | Written before tests and implementation. First draft prepared with an AI assistant (Claude Code) and checked by the owner against `docs/srs.md` and the F-03/F-04 contracts |
| 1.1 | 2026-11-28 | Film26 | Implementation details made explicit, no rule changed: §3 a `?milestoneId=` of another course → 404; "my ratings" for a milestone of a course the student is not enrolled in → 403; `rating` in the 201 body has no rater field; §5 the button sits next to **Submit / Resubmit** for students in a team; §8 DoD ticked with evidence | Written with the implementation (RED `c44305b` before code); first draft of code and tests with Claude Code, checked by the owner |

## 1. Linked requirements (summary)

| ID | Requirement / rule |
|---|---|
| FR-19 | A Student can rate each teammate (1–5 + comment) once per milestone. |
| FR-20 | An Instructor can view per-student average peer ratings for their course. |
| BR-13 | A student cannot rate themselves, rates each teammate at most once per milestone, and cannot see individual ratings given by others. |
| NFR-02 / 03 / 05 / 06 / 09 | 401; 403 without data; one error shape; no partial data; loading/empty/error states. |

## 2. Behaviour

### Business rules as implemented
- **E1 (BR-13, self)** `rateeId = me` → `409 SELF_RATING`. Also DB `CHECK ("raterId" <> "rateeId")`.
- **E2 (BR-13, teammate)** The ratee must be a **current** member of the rater's team in the milestone's course; otherwise `409 NOT_A_TEAMMATE` (also for unknown user ids, so the API does not reveal who exists).
- **E3 (BR-13, once)** One rating per (milestone, rater, ratee): DB unique; a second attempt → `409 ALREADY_RATED` (no edit, no delete).
- **E4 (BR-13, privacy)** Students only see the ratings **they gave**. No endpoint returns a rating given by someone else to a student, and the instructor view shows averages and counts per student, plus the comments without the rater's name.
- **E5 Ownership.** Rate and "my ratings": role STUDENT, member of a team in the milestone's course (`409 NO_TEAM` without a team). Summary: role INSTRUCTOR and owns the course.
- **E6 Average.** Per student: mean of all scores received (all milestones, or one with `?milestoneId=`), rounded to 2 decimals, with the count. A student with no ratings has `average: null, count: 0`.

### Validation
| Field | Rule | Error |
|---|---|---|
| `rateeId` | required; positive integer | 400 `details.rateeId` |
| `score` | required; integer 1–5 | 400 `details.score` |
| `comment` | optional; trimmed; 0–500 chars | 400 `details.comment` |
| `milestoneId` query | optional; positive integer | 400 |

## 3. API contract

| Method & path | Who | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/milestones/:id/peer-ratings` | STUDENT, member of a team in the course | `{ rateeId, score, comment? }` | `201 { rating: { id, milestoneId, ratee: { id, displayName }, score, comment, createdAt } }` | 400, 401, 403, 404, 409 `SELF_RATING` / `NOT_A_TEAMMATE` / `ALREADY_RATED` / `NO_TEAM` |
| `GET /api/milestones/:id/peer-ratings/mine` | STUDENT, as above | — | `200 { milestone, teammates: [ { id, displayName, rated: boolean, myRating: { score, comment } \| null } ] }` | 401, 403, 404, 409 `NO_TEAM` |
| `GET /api/courses/:courseId/peer-ratings` | INSTRUCTOR, owns course | `?milestoneId=` (must belong to the course, else 404) *(v1.1)* | `200 { course, students: [ { id, displayName, team: { id, name } \| null, average, count, comments: [string] } ] }` sorted by team, name | 400, 401, 403, 404 |

Modules: `src/peer/rules.js` (`validateRatingInput`, `averageOf`), `src/peer/service.js`, `src/routes/peer.js`.

## 4. Data

Migration `f07_peer_ratings`: `PeerRating { id, milestoneId (FK Milestone, cascade), teamId (FK Team, cascade), raterId (FK User), rateeId (FK User), score Int, comment @default(""), createdAt }`, `@@unique([milestoneId, raterId, rateeId])`, `@@index([rateeId])`; SQL `CHECK (score BETWEEN 1 AND 5)`, `CHECK ("raterId" <> "rateeId")`. No seed ratings.

## 5. UI
| Screen | Behaviour |
|---|---|
| Milestones (Student, F-04) | Each row gets **Rate teammates** → list of teammates with a 1–5 selector and comment (counter), **Submit rating** per teammate; rated teammates show "Rated: 4" read-only. Server errors in an alert. |
| Peer ratings (Instructor) | From the course card. Milestone filter (All / M1 …). Table: team, student, average, count, comments (expandable, no rater names). Loading / empty / error states. |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-07-01 | A team member rates a teammate for a milestone with score 1–5 and a comment → 201 and one row is stored with the rater from the session. | FR-19 |
| AC-07-02 | Missing/invalid `rateeId`, score 0, 6, 3.5, or > 500-char comment → 400 naming the field; nothing stored. Scores 1 and 5 are accepted. | FR-19, NFR-05 |
| AC-07-03 | Rating oneself → 409 `SELF_RATING`; nothing stored. | BR-13 |
| AC-07-04 | Rating a student of another team, an unknown user or a former member → 409 `NOT_A_TEAMMATE`; nothing stored. | BR-13 |
| AC-07-05 | A second rating of the same teammate for the same milestone → 409 `ALREADY_RATED`; the first rating is unchanged. The same teammate can be rated again for another milestone. Two concurrent first ratings store one. | BR-13, NFR-06 |
| AC-07-06 | "My ratings" lists the student's teammates with only the ratings **they** gave; no response to a student contains a rating given by someone else. | BR-13 |
| AC-07-07 | The course instructor sees per-student average and count (all milestones and per milestone); students without ratings show `null` / 0. | FR-20 |
| AC-07-08 | Instructors cannot rate (403); students cannot read the summary (403); an instructor of another course cannot read it (403); a student outside the course cannot rate (403); no session → 401. | NFR-02, NFR-03 |
| AC-07-09 | UI: student1 rates student2 (4) for M1, sees "Rated: 4"; instructor1 sees student2's average 4.00 (1 rating). | FR-19, FR-20, NFR-09 |

## 7. Software Test Specification

| Test ID | AC | Level | Input | Expected |
|---|---|---|---|---|
| TEST-07-01 | AC-07-02 | Unit | `validateRatingInput` with scores 0/1/5/6/3.5/"4", comment 500/501 chars, missing `rateeId` | 1 and 5 ok; others rejected naming the field |
| TEST-07-02 | AC-07-07 | Unit | `averageOf([])`, `[4]`, `[4, 5, 5]` | null, 4, 4.67 |
| TEST-07-03 | AC-07-01 | API+DB | Alpha (s1, s2), M1 | s1 rates s2 with `raterId: s2` in body | 201; DB row rater s1, ratee s2 |
| TEST-07-04 | AC-07-02 | API+DB | — | bodies from TEST-07-01 | 400 each; 0 rows |
| TEST-07-05 | AC-07-03, AC-07-04 | API+DB | s3 in Beta; user 999999; s2 removed from Alpha | s1 rates s1, s3, 999999, s2 | 409 `SELF_RATING`, then `NOT_A_TEAMMATE` ×3; 0 rows |
| TEST-07-06 | AC-07-05 | API+DB | s1 rated s2 on M1 | rate again on M1; rate on M2; 2 concurrent first ratings by s2 of s1 | 409, row unchanged; 201; one 201 + one 409 |
| TEST-07-07 | AC-07-06 | API+DB | s1→s2 (4), s3→… none, s2→s1 (2) | s1 GET mine | teammates [s2 rated 4]; body never contains score 2 or s2's comment |
| TEST-07-08 | AC-07-07 | API+DB | s2 received 4 and 5 on M1, M2 | instructor1 GET; `?milestoneId=M1` | s2 average 4.5 count 2; M1 only: 4 count 1; s5 null/0 |
| TEST-07-09 | AC-07-08 | API+DB | instructor1, s1, instructor2, outsider, no cookie | each forbidden call | 403 ×4 without data; 401 |
| TEST-07-10 | AC-07-09 | E2E | `cpms_e2e` | journey of AC-07-09 | screenshots `F07-*.png` |

## 8. Definition of Done
- [x] AC-07-01 … 09 implemented; TEST-07-01 … 09 in `npm test` (`server/tests/peer.unit.test.js`, `peer.api.test.js`, 27 tests), TEST-07-10 in E2E (`e2e/peer.spec.js`).
- [x] RED/GREEN evidence: `evidence/F-07-tdd-red.txt` (26 failed / 1 passed on `c44305b`), `evidence/F-07-tdd-green.txt` (27/27; whole server suite 269/269; E2E 12/12); screenshots `F07-1-student-rated.png`, `F07-2-instructor-summary.png`.
- [ ] PR into `sprint-3` reviewed by jaruwan18; `Closes #44`.

## 9. Known limitations
- Ratings cannot be changed or withdrawn (BR-13 "at most once").
- Comments are shown to the instructor without rater names, but in a team of 2 the rater can be inferred.
