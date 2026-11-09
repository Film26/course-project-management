# Feature Inventory
## Course Project Management System (CPMS)

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Source of IDs | FR / BR / NFR from `docs/srs.md` |
| Related | `docs/traceability.md` (requirement → feature → sprint → AC/TEST), `docs/sprints/plan.md` |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | 67070507202 | Initial inventory F-01 to F-09 and system responsibilities SR-01 to SR-04 |
| 0.2 | 2026-11-09 | 67070507202 | SR-03: NFR-07 verification is the README run recorded in the release PR, not yet done (aligned with `traceability.md` v0.3, PR #9 review) |

---

## 1. Product features

Status key: **Done** = merged into `sprint-1` with passing tests · **Planned** = allocated to a later sprint, contract written at the start of that sprint.

| ID | Feature | Short description | Requirements | Depends on | Sprint | Status / contract |
|---|---|---|---|---|---|---|
| **F-01** | Authentication & role-based access | Login, logout and current user through server-side sessions. Instructor/Student roles, backend role and ownership checks. Instructors see the roster of the courses they teach. | FR-01, FR-02, FR-03, FR-04 · NFR-01, NFR-02, NFR-03, NFR-04 | Baseline scaffold (data model, seed) | **1** | Done: `docs/sprints/sprint-1/F-01-auth.md` (v1.1), PR #3 |
| **F-02** | Project proposal workflow | A Student creates a draft proposal for their team, edits it and submits it. The course Instructor lists the proposals, then approves them or rejects them with a reason. State machine `DRAFT → SUBMITTED → APPROVED / REJECTED`. | FR-05, FR-06, FR-07, FR-08, FR-09 · BR-01, BR-02, BR-03, BR-04, BR-05 · NFR-02, NFR-03, NFR-05, NFR-06, NFR-09 | F-01 | **1** | Done: `docs/sprints/sprint-1/F-02-proposal.md` (v1.2), PR #6 |
| **F-03** | Team formation | A Student creates a team (gets a join code), joins or leaves one. Team-size limits apply, and membership locks once the proposal is approved. Seeded teams are replaced by teams the students form themselves. | FR-10, FR-11, FR-12 · BR-06, BR-07, BR-08 | F-01, F-02 (BR-07 adds a minimum-size check to F-02 submit; BR-08 reads proposal status) | **2** | Planned |
| **F-04** | Course milestones | The Instructor creates, edits and deletes milestones (title, due date, weight, max score). Students see the milestones and their team's status for each. | FR-13, FR-14 · BR-09 | F-01 | **2** | Planned |
| **F-05** | Deliverable submission | A team member submits a URL and a note for a milestone. Resubmitting keeps the version history, and late work is flagged `LATE`. | FR-15, FR-16 · BR-10, BR-11 | F-02 (approved proposal), F-04 | **2** | Planned |
| **F-06** | Grading & feedback | The Instructor scores a submission, writes feedback and releases the grade. The team sees only released grades. | FR-17, FR-18 · BR-12 | F-05 | **2** | Planned |
| **F-07** | Peer evaluation | A Student rates each teammate (1–5 + comment) once per milestone. The Instructor sees per-student averages. | FR-19, FR-20 · BR-13 | F-03, F-04 | **3** | Planned |
| **F-08** | Course dashboard | Per-team overview for the Instructor: proposal status, submissions, late count and released grades. | FR-21 · NFR-10 | F-02, F-05, F-06 | **3** | Planned |
| **F-09** | Audit log | Records proposal decisions, grade releases and membership changes. The course Instructor can view the log. | FR-22 | F-02, F-03, F-06 | **3** | Planned |

## 2. Cross-cutting system responsibilities

Some NFRs do not belong to one feature. The table names the responsibility that owns each one, the sprint that **establishes** it and the sprint that **verifies** it.

| ID | Responsibility | Requirements | Established | Verified | Notes |
|---|---|---|---|---|---|
| **SR-01** | Access control (session, role and ownership checks on every protected endpoint) | NFR-02, NFR-03 | S1 (F-01 middleware) | S1, then again in S2 and S3 for each new endpoint | Each feature contract adds API tests for 401/403 on its own endpoints. |
| **SR-02** | API error handling and data integrity (single error shape, safe 5xx, no partial writes) | NFR-05, NFR-06 | S1 (`errors.js`, F-02 transactions) | S1 (4xx shapes, DB state after rejected requests), S2 (forced 500 test) | |
| **SR-03** | Engineering baseline (reproducible setup, configuration and secrets, deployability) | NFR-07, NFR-08 | S1 (README, `.env.example`, migrations, seed) | S1 (teammate follows the README on a clean clone, time recorded in the Sprint 1 release PR), S2 / Lab 5 (Docker, Cloud Run) | NFR-07 is not verified until that run is recorded (traceability G-06). PR #10 fixed two clean-clone setup failures found on the way. |
| **SR-04** | Quality and UX standards (loading/empty/error states, test coverage, performance) | NFR-09, NFR-10, NFR-11 | S1 (NFR-09), S2 (NFR-11), S3 (NFR-10) | NFR-09 in every sprint (E2E), NFR-11 in S2 and S3, NFR-10 in S3 | |

## 3. Coverage check

- Every FR from FR-01 to FR-22 maps to exactly one feature (F-01 to F-09).
- Every BR from BR-01 to BR-13 maps to at least one feature.
- Every NFR from NFR-01 to NFR-11 maps to a feature or to a system responsibility (SR-01 to SR-04).
- Requirements without a feature: **none**.
- The detailed matrix (requirement → feature → sprint → AC/TEST) and the coverage gaps are in `docs/traceability.md`.
