# Software Requirements Specification (SRS)
## Course Project Management System (CPMS)

| Item | Value |
|---|---|
| Course | CPE 334 — Semester 1/2026 |
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Repository | https://github.com/Film26/course-project-management |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Master specification | `group_work_specs.docx` (Group Work Specification). Theme assignment confirmed in the course registration sheet: team TH-034, theme 6 Course Project Management System, Sprint 1 roles Student / Supervisor. The full document with the Sprint 1 example was not available to the team (see Q-05). |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | 67070507202 | First draft of the full-product baseline: actors, scope, FR/BR/NFR, decisions |
| 0.2 | 2026-11-10 | 67070507202 | Q-05 closed: theme and Sprint 1 roles confirmed from the registration sheet (Supervisor = Instructor); the Sprint 1 example itself was not available, so the scope is checked against the Deliverable 1 required outcome |

---

## 1. Stakeholder problem and context

In a project-based university course, instructors supervise many student teams through the same
sequence: form teams → propose a project → deliver milestones → receive grades and feedback.
Today this is handled with spreadsheets, chat groups and e-mail. As a result:

- the instructor cannot see, in one place, which teams have a proposal, which are approved and which are late;
- proposals are sent twice or after the deadline, and approval decisions and reasons get lost in chat;
- students cannot reliably tell the current status of their own team's work;
- private information (another team's proposal, grades, peer ratings) is shared too widely.

**CPMS** is a web application for one course offering at a time (e.g. CPE 334). It gives each actor
a single source of truth for the course project lifecycle and enforces the course rules on the server.

## 2. Actors and responsibilities

| Actor | Description | Responsibilities in CPMS |
|---|---|---|
| **Instructor** (the theme's *Supervisor*) | Lecturer who owns a course and supervises its project teams | Configures the course (deadline, milestones); reviews and approves/rejects proposals; grades submissions and writes feedback; monitors all teams of **their own** courses. |
| **Student** | Enrolled student, member of exactly one team per course | Drafts and submits the team's proposal; submits milestone deliverables; views own team's status, decisions and released grades; evaluates teammates. |
| **System** (non-human) | CPMS backend | Authenticates users, enforces roles/ownership and business rules, records timestamps and decision history. |
| *Course administrator* (out of scope) | Creates accounts/courses | Replaced by reproducible **seed data** in this project (see D-02). |

## 3. Product scope

### 3.1 In scope (whole product, Sprints 1–3)
1. Login, logout, current-user identity and role-based access (Instructor / Student).
2. Course roster: teams and members of a course, visible to the course's instructor.
3. Project proposal workflow with a state machine `DRAFT → SUBMITTED → APPROVED | REJECTED`.
4. Team formation by students with size limits and a join code.
5. Course milestones with due dates and weights.
6. Milestone deliverable submission (link + note) with late detection and version history.
7. Grading and written feedback, released to the team by the instructor.
8. Peer evaluation of teammates per milestone.
9. Instructor course dashboard and an audit trail of important decisions.

### 3.2 Explicit exclusions
| Excluded | Reason |
|---|---|
| Self-registration, password recovery, account administration UI | Not required by the deliverable; accounts come from seed data. |
| File upload / binary storage of deliverables | Deliverables are submitted as URLs (e.g. GitHub, Google Drive) — see D-06. |
| E-mail / push notifications | Not needed for the core workflow; status is visible in the app. |
| Integration with LEB2 or other LMS, plagiarism checking | Outside the course project scope. |
| Multiple instructors / TAs per course | One instructor per course (A-04); TA role can be added later. |
| Native mobile app | Responsive web UI only. |

## 4. Functional requirements (FR)

IDs are stable. *Planned* = feature and sprint allocation (details in `docs/features.md`, `docs/sprints/plan.md`).

| ID | Requirement (observable behaviour) | Actor | Feature / Sprint |
|---|---|---|---|
| **FR-01** | A seeded user can log in with e-mail and password and receives an authenticated session. | All | F-01 / S1 |
| **FR-02** | A logged-in user can log out; the same session cannot be used afterwards. | All | F-01 / S1 |
| **FR-03** | The system returns the current user's identity and role from the session, never from client-supplied data. | All | F-01 / S1 |
| **FR-04** | An Instructor can view the roster (teams and members) of a course they teach. | Instructor | F-01 / S1 |
| **FR-05** | A Student can create and edit a **draft** proposal (title, description) for their own team. | Student | F-02 / S1 |
| **FR-06** | A Student can submit their team's draft proposal; its status becomes `SUBMITTED` and the submission time is recorded. | Student | F-02 / S1 |
| **FR-07** | An Instructor can list the proposals of a course they teach, filtered by status. | Instructor | F-02 / S1 |
| **FR-08** | An Instructor can approve or reject a submitted proposal; a rejection includes a reason; the decision time and decider are recorded. | Instructor | F-02 / S1 |
| **FR-09** | Team members can view their team's proposal, its status and the decision/reason. | Student | F-02 / S1 |
| **FR-10** | A Student can create a team in a course and receives a join code. | Student | F-03 / S2 |
| **FR-11** | A Student can join a team using its join code. | Student | F-03 / S2 |
| **FR-12** | A Student can leave their team while the team has no approved proposal. | Student | F-03 / S2 |
| **FR-13** | An Instructor can create, edit and delete milestones (title, description, due date, weight %) for their course. | Instructor | F-04 / S2 |
| **FR-14** | Students can view the milestones of their course with due dates and their team's submission status. | Student | F-04 / S2 |
| **FR-15** | A team member can submit a deliverable (URL + note) for a milestone. | Student | F-05 / S2 |
| **FR-16** | A team can resubmit before the due date; the latest version is current and previous versions are kept. | Student | F-05 / S2 |
| **FR-17** | An Instructor can grade a submission (score, written feedback) and release it to the team. | Instructor | F-06 / S2 |
| **FR-18** | Team members can view released grades and feedback for their own team only. | Student | F-06 / S2 |
| **FR-19** | A Student can rate each teammate (1–5 + comment) once per milestone. | Student | F-07 / S3 |
| **FR-20** | An Instructor can view per-student average peer ratings for their course. | Instructor | F-07 / S3 |
| **FR-21** | An Instructor can view a course dashboard: per team proposal status, milestone submissions, late count and released grades. | Instructor | F-08 / S3 |
| **FR-22** | The system records an audit entry for proposal decisions, grade releases and team membership changes, viewable by the course instructor. | Instructor | F-09 / S3 |

## 5. Business rules (BR)

| ID | Rule (testable) | Related FR | Feature / Sprint |
|---|---|---|---|
| **BR-01** | A team can have at most **one active proposal** (status `DRAFT`, `SUBMITTED` or `APPROVED`). A new proposal may be created only after the previous one was `REJECTED`. | FR-05 | F-02 / S1 |
| **BR-02** | A proposal cannot be submitted after the course's `proposalDeadline` (server time). | FR-06 | F-02 / S1 |
| **BR-03** | Allowed proposal transitions: `DRAFT→SUBMITTED` (team member), `SUBMITTED→APPROVED` and `SUBMITTED→REJECTED` (course instructor). Any other transition is rejected; `APPROVED` and `REJECTED` are final. | FR-06, FR-08 | F-02 / S1 |
| **BR-04** | Rejecting a proposal requires a non-empty reason of at most 500 characters. | FR-08 | F-02 / S1 |
| **BR-05** | Only members of a team may create, edit, submit or read that team's proposal; only the course's instructor may decide on it. | FR-05–FR-09 | F-02 / S1 |
| **BR-06** | A student belongs to at most one team per course. | FR-10, FR-11 | F-03 / S2 |
| **BR-07** | Team size is between the course's `minTeamSize` and `maxTeamSize` (default 2–3); joining a full team is rejected; a proposal can be submitted only when the team has at least `minTeamSize` members. | FR-11, FR-06 | F-03 / S2 |
| **BR-08** | Team membership is locked once the team's proposal is `APPROVED`. | FR-12 | F-03 / S2 |
| **BR-09** | The sum of milestone weights in a course cannot exceed 100 %. | FR-13 | F-04 / S2 |
| **BR-10** | Only a team with an `APPROVED` proposal can submit milestone deliverables. | FR-15 | F-05 / S2 |
| **BR-11** | A submission after the milestone due date is accepted but marked `LATE`; resubmission after the due date is not allowed once a non-late version exists. | FR-15, FR-16 | F-05 / S2 |
| **BR-12** | A score must be between 0 and the milestone's maximum score; grades are visible to students only after release. | FR-17, FR-18 | F-06 / S2 |
| **BR-13** | A student cannot rate themselves, rates each teammate at most once per milestone, and cannot see individual ratings given by others. | FR-19, FR-20 | F-07 / S3 |

## 6. Non-functional requirements (NFR)

| ID | Requirement and measurable target | Verification method | Established / verified |
|---|---|---|---|
| **NFR-01** | Passwords are stored only as bcrypt hashes (cost ≥ 10 outside tests); no API response contains a password or token hash. | Unit test of hashing; API test inspects response bodies | S1 / S1 |
| **NFR-02** | Any unauthenticated request to a protected endpoint returns **401** and no private data. | API tests over all protected endpoints | S1 / S1, re-checked each sprint |
| **NFR-03** | Role and ownership are enforced in the backend: a forbidden operation returns **403** and no private data, independent of the UI. | API tests per protected operation (role matrix, SDS §5) | S1 / every sprint |
| **NFR-04** | Sessions expire after `SESSION_TTL_HOURS` (default 8 h) and are revoked on logout; expired/revoked sessions are rejected. | Unit test of expiry boundary; API test of expired and logged-out sessions | S1 / S1 |
| **NFR-05** | Errors use one JSON shape `{error:{code,message,details?}}`; 5xx responses never contain stack traces, SQL or internal identifiers. | API tests for 400/401/403/404; forced-error test | S1 / S2 |
| **NFR-06** | Business rules are enforced in the application layer **and** backed by database constraints where possible (unique, FK, NOT NULL); a rule violation never leaves partial data. | Integration tests check DB state after rejected requests | S1 / every sprint |
| **NFR-07** | Reproducibility: a new developer can clone, configure `.env`, migrate, seed and run all tests in ≤ 15 minutes using the README only. | Teammate follows README on a clean machine (manual check recorded in PR) | S1 / S1, S3 |
| **NFR-08** | Deployability: all configuration via environment variables; no secrets in Git or client code; the app runs as a single Docker container against managed PostgreSQL. | Secret scan of repo; Docker build + run (Lab 5) | S1 design / Lab 5 (S2) |
| **NFR-09** | Usability: every data screen has loading, empty and error states; forms show field validation messages before/after submit. | Playwright E2E checks + UI review checklist | S1 / every sprint |
| **NFR-10** | Performance: list endpoints (`/courses/:id/roster`, proposal list, dashboard) respond in **p95 < 500 ms** with 50 teams × 3 students on the reference deployment. | Load script (e.g. autocannon) against seeded large dataset | S3 / S3 |
| **NFR-11** | Test quality: domain-rule modules have ≥ 80 % line coverage; every AC has at least one automated or recorded manual verification. | `vitest --coverage`; AC-to-test table | S2 / S2, S3 |

## 7. Assumptions

| ID | Assumption |
|---|---|
| A-01 | Users and courses are provisioned by seed data; there is no sign-up. |
| A-02 | In Sprint 1, teams and memberships are seeded; student-driven team formation arrives with F-03 in Sprint 2. |
| A-03 | All timestamps are stored in UTC; the UI displays Asia/Bangkok time. Deadlines are compared on the server clock. |
| A-04 | A course has exactly one instructor. |
| A-05 | Deliverables are external URLs that the instructor can open; CPMS does not verify their content. |
| A-06 | Users access CPMS with a current desktop or mobile browser with cookies enabled. |

## 8. Design decisions

| ID | Decision | Alternatives considered | Rationale |
|---|---|---|---|
| D-01 | **Server-side sessions** in PostgreSQL with an HttpOnly, SameSite=Lax cookie. | JWT in localStorage | Logout truly revokes access (FR-02); token not readable by JavaScript; simple expiry. |
| D-02 | Accounts from **reproducible seed data**. | Registration UI | Allowed by the deliverable; keeps scope on the domain. |
| D-03 | **React + Express + PostgreSQL (Prisma)** in one npm-workspace repository. | Next.js; Django | Clear UI / API / DB separation; team familiarity; Prisma migrations and seed. |
| D-04 | Business rules live in the **API/application layer** and DB constraints; the UI only mirrors them for convenience. | Rules in UI | A hidden button is not authorization (NFR-03). |
| D-05 | Proposal history: a rejected proposal stays stored; the team creates a new proposal. | Edit-in-place after rejection | Keeps decision history and reasons (FR-08, FR-22). |
| D-06 | Deliverables submitted as **URLs**, not uploaded files. | Cloud Storage upload | Avoids file storage/virus scanning in the course timeframe; can be added later. |
| D-07 | Same-origin deployment: Express serves the built React app and `/api` from one container. | Separate frontend hosting + CORS | Cookies stay same-origin; one Cloud Run service. |

## 9. Questions and resolutions

| ID | Question | Resolution | Date |
|---|---|---|---|
| Q-01 | Do we need a TA role? | No for this baseline; one instructor per course (A-04). Revisit in Sprint 3 if time allows. | 2026-11-07 |
| Q-02 | Can a team resubmit after rejection? | Yes — by creating a **new** proposal; the rejected one is kept (D-05, BR-01). | 2026-11-07 |
| Q-03 | Are late milestone submissions allowed? | Yes, but marked `LATE` (BR-11). | 2026-11-07 |
| Q-04 | Should unknown e-mail and wrong password give different errors? | No — identical 401 to avoid account enumeration (F-01 rule R1). | 2026-11-07 |
| Q-05 | Does the Sprint 1 slice match the theme's Sprint 1 example in `group_work_specs.docx`? | **Closed; theme and roles confirmed, Sprint 1 example not compared.** The course registration sheet (*Project themes (Group Work Specification §6)*) confirms team TH-034 on theme 6 Course Project Management System with Sprint 1 roles **Student / Supervisor**. In this product the Supervisor is the **Instructor**: the person who supervises the course's teams and approves or rejects their proposals, so the code keeps the role name `INSTRUCTOR`. The theme's Sprint 1 example in the full `group_work_specs.docx` was not available to the team and was not compared. Instead the slice was checked against the required Sprint 1 outcome in `project_deliverable_1_v1.pdf` §2: (1) complete journey UI → API → database: proposal create → submit → approve/reject, read back (TEST-02-20); (2) real login, logout, current user and two roles Instructor/Student (F-01, TEST-01-13); (3) a state transition `DRAFT → SUBMITTED → APPROVED/REJECTED` with business rules BR-01 to BR-05 (F-02); (4) automated tests for rules, persistence and access: 62 unit and API/DB tests and 4 E2E tests; (5) Issues, feature branches, reviewed PRs, `sprint-1` staging and a release on `main`. The reasons for the scope are in `plan.md` §3. If the theme example differs, the difference is recorded here and in `traceability.md` G-08. Disclosed as a known limitation in the Deliverable 1 PDF. | 2026-11-10 |
