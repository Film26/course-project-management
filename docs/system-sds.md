# System-Level Software Design Specification (SDS)
## Course Project Management System (CPMS)

| Item | Value |
|---|---|
| Team | 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Document owner | 67070507202 · reviewed by 67070507216 |
| Related | `docs/srs.md` (requirements), `docs/features.md`, `docs/sprints/sprint-1/*` (feature contracts) |

### Version history

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-11-07 | 67070507202 | First draft: architecture, data model, UI/API conventions, access matrix, auth, configuration, deployment plan |

---

## 1. Architecture and stack

### 1.1 Stack

| Layer | Technology | Responsibility |
|---|---|---|
| UI | React 18 + Vite (`client/`) | Screens, navigation, client-side form validation, loading/empty/error states. Holds **no** authorization logic and never stores tokens. |
| API / application | Node.js 20+ + Express 5 (`server/src/`) | HTTP endpoints, input validation, authentication, role/ownership checks, **business rules** and state transitions, error mapping. |
| Data access | Prisma 6 ORM (`server/prisma/`) | Schema, versioned SQL migrations, typed queries, transactions, seed. |
| Database | PostgreSQL 15+ | Durable storage; constraints (PK, FK, UNIQUE, NOT NULL, enums) as the last line of integrity. |
| Tests | Vitest + Supertest; Playwright | Unit (pure rules), API/DB integration against a separate `cpms_test` DB, UI end-to-end. |

### 1.2 Component diagram

```
 Browser
 ┌───────────────────────────┐
 │ React SPA (client/)       │
 │  pages: Login, Home,      │
 │  Roster, Proposals, ...   │      same origin; cookie "sid" (HttpOnly)
 │  api.js (fetch wrapper) ──┼──────────────────────────────┐
 └───────────────────────────┘                              │  JSON over HTTPS
                                                            ▼
 Express API (server/src/)                       ┌─────────────────────────┐
 ┌──────────────────────────────────────────────►│ routes/   (HTTP layer)  │ parse + validate input,
 │                                               │  auth.js, courses.js,   │ map result to JSON / status
 │                                               │  proposals.js (F-02)…   │
 │                                               ├─────────────────────────┤
 │                                               │ auth/middleware.js      │ requireAuth → req.user from session
 │                                               │  requireAuth, requireRole│ requireRole → 403
 │                                               ├─────────────────────────┤
 │                                               │ domain rules / services │ BR-xx checks, state machine,
 │                                               │  (e.g. proposal rules)  │ ownership checks, transactions
 │                                               ├─────────────────────────┤
 │                                               │ db.js (Prisma Client)   │
 │                                               └───────────┬─────────────┘
 │                                                           │ SQL (TCP 5432 / Cloud SQL connector)
 │                                                           ▼
 │                                               ┌─────────────────────────┐
 └ errors.js: one error shape for all failures   │ PostgreSQL               │
                                                 │ cpms_dev / cpms_test /   │
                                                 │ production DB            │
                                                 └─────────────────────────┘
```

### 1.3 Communication and where rules are enforced
- The SPA calls only relative `/api/...` URLs. In development Vite proxies `/api` to `localhost:3000`; in production Express serves the built SPA and the API from the **same origin** (D-07), so the session cookie is never cross-site and no CORS is needed.
- **Authentication** — `requireAuth` middleware resolves the user from the `sid` cookie on every protected request.
- **Authorization** — `requireRole(...)` for role checks; **ownership** (e.g. "instructor of this course", "member of this team") is checked in the route/service against the database, never against IDs supplied by the client.
- **Business rules** (BR-01…BR-13) — enforced in the application layer before writing, inside a transaction when several rows change; backed by DB constraints (e.g. unique membership).
- The UI repeats simple checks (required fields, hiding buttons) only for usability.

## 2. Data model

### 2.1 Entity–relationship overview

```
 User 1───* Session
  │ 1
  ├────────* TeamMember *───1 Team *───1 Course *───1 User (instructor)
  │                              │ 1          │ 1
  │                              ├───* Proposal ──decidedBy──► User
  │                              ├───* Submission *───1 Milestone *───1 Course      (S2)
  │                              │        └──1 Grade (S2)
  │                              └───* PeerReview (reviewer, reviewee, milestone)   (S3)
  └── AuditLog (actor, course, action, entity, at)                                  (S3)
```

### 2.2 Entities — implemented in Sprint 1 (migration `20261107000000_init`)

| Entity | Key fields | Constraints and ownership |
|---|---|---|
| **User** | id, email, passwordHash, displayName, role (`INSTRUCTOR`/`STUDENT`), createdAt | `email` UNIQUE (stored lower-case). `passwordHash` never leaves the server. |
| **Session** | id, tokenHash, userId, createdAt, expiresAt, revokedAt? | `tokenHash` UNIQUE; FK user (cascade delete); index on userId. Active ⇔ `revokedAt IS NULL AND now < expiresAt`. |
| **Course** | id, code, name, instructorId, proposalDeadline | `code` UNIQUE; FK instructor → User. **Owner:** the instructor. |
| **Team** | id, name, courseId | UNIQUE (courseId, name); FK course (cascade). |
| **TeamMember** | teamId, userId | PK (teamId, userId); FKs cascade. **Owner of team data:** its members. |
| **Proposal** | id, teamId, title, description, status (`DRAFT`/`SUBMITTED`/`APPROVED`/`REJECTED`), rejectReason?, submittedAt?, decidedAt?, decidedById?, createdAt, updatedAt | FK team (cascade); FK decidedBy → User; index teamId. **Readable by:** team members and the course instructor. |

### 2.3 Entities and changes planned for Sprints 2–3 (each via a new migration)

| Change | Fields / constraints | For |
|---|---|---|
| Course + `minTeamSize`, `maxTeamSize` | ints, default 2 and 3, CHECK min ≤ max | BR-07 |
| Team + `joinCode` | UNIQUE random 8-char code | FR-11 |
| Unique membership per course | enforce "one team per course" (application check + unique index on a `(courseId, userId)` column added to TeamMember) | BR-06 |
| **Milestone** | id, courseId, title, description, dueAt, weight (0–100), maxScore | FR-13, BR-09 |
| **Submission** | id, milestoneId, teamId, url, note, submittedById, submittedAt, isLate, version | FR-15/16, BR-10/11; UNIQUE (milestoneId, teamId, version) |
| **Grade** | id, submissionId (UNIQUE), score, feedback, gradedById, releasedAt? | FR-17/18, BR-12 |
| **PeerReview** | id, milestoneId, reviewerId, revieweeId, rating 1–5, comment | FR-19/20, BR-13; UNIQUE (milestoneId, reviewerId, revieweeId); CHECK reviewer ≠ reviewee |
| **AuditLog** | id, courseId, actorId, action, entityType, entityId, data JSON, createdAt | FR-22 |

### 2.4 Database setup, migrations and seed
- Schema source of truth: `server/prisma/schema.prisma`. Every change is a new folder in `server/prisma/migrations/` created with `npm run db:dev -w server -- --name <change>` and committed with the feature.
- Apply migrations: `npm run db:migrate` (`prisma migrate deploy`, no data loss, used in all environments).
- Seed: `npm run db:seed` — idempotent upserts of synthetic users (`instructor1@cpms.test`, `student1..3@cpms.test`), course CPE334 and two teams. Password comes from `SEED_PASSWORD`; nothing real is committed.
- Tests use a separate database (`cpms_test` from `server/.env.test`): migrations are applied once per run and tables are truncated before each test.

## 3. UI design

### 3.1 Screens and navigation

```
 Login ──(success)──► Home: "My courses"
                        ├─ Instructor: course → Roster (S1) · Proposals review (S1)
                        │               · Milestones (S2) · Grading (S2) · Dashboard (S3)
                        └─ Student:    course → My team & proposal (S1) · Milestones &
                                        submissions (S2) · Grades (S2) · Peer evaluation (S3)
 Header on every logged-in screen: product name · current user name + role badge · Log out
```

| Screen | Sprint | Roles |
|---|---|---|
| Login | S1 | public |
| Home — my courses | S1 | all |
| Course roster | S1 | Instructor (owner) |
| Team proposal (create / edit draft / submit / view decision) | S1 | Student (member) |
| Proposal review list + approve / reject | S1 | Instructor (owner) |
| Team formation (create / join / leave) | S2 | Student |
| Milestones (manage / view) | S2 | Instructor / Student |
| Submissions and grading | S2 | Student / Instructor |
| Peer evaluation | S3 | Student / Instructor |
| Course dashboard, audit log | S3 | Instructor |

### 3.2 Shared UI behaviour
| Concern | Convention |
|---|---|
| Session | On load the app calls `GET /api/auth/me`; shows "Loading…" until it answers; 401 → Login page. Any later 401 also returns to Login. |
| Loading | Every fetch shows an inline "Loading …" text; submit buttons are disabled and change label (e.g. "Signing in…"). |
| Empty | Lists show a sentence explaining the empty state (e.g. "No teams yet."). |
| Errors | The server `error.message` is shown in a red `role="alert"` element; 403 shows "You do not have access …". No stack traces are shown. |
| Validation | Required fields checked before submit; server `details` (field → message) shown next to fields. |
| Role-specific controls | Buttons for forbidden actions are hidden for convenience only; the API enforces access (§5). |

## 4. API conventions

| Topic | Convention |
|---|---|
| Base path | `/api`; resources in plural nouns: `/api/courses/:courseId/...`, `/api/proposals/:id` |
| Methods | `GET` read, `POST` create / action (`/submit`, `/approve`, `/reject`), `PATCH` partial update, `DELETE` remove |
| Format | JSON request/response, `Content-Type: application/json`, body limit 100 kB |
| Success | `200` with a named top-level object (`{ "user": … }`, `{ "courses": [...] }`), `201` for create, `204` for no body |
| Errors | Always `{ "error": { "code": "UPPER_SNAKE", "message": "human text", "details"?: { field: message } } }` |
| Status codes | `400 VALIDATION_ERROR / INVALID_JSON`, `401 UNAUTHENTICATED / INVALID_CREDENTIALS`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409` business-rule conflict (e.g. `ACTIVE_PROPOSAL_EXISTS`, `DEADLINE_PASSED`, `INVALID_TRANSITION`), `500 INTERNAL_ERROR` |
| Validation | Every route validates types, required fields, lengths and IDs (positive integers) before touching the DB |
| Safe errors | Unknown errors are logged on the server and returned as a generic `500 INTERNAL_ERROR` (NFR-05) |
| Identity | Never accepted from body/query/headers; always `req.user` from the session |
| Not-found vs forbidden | `404` when the resource does not exist; `403` when it exists but the user may not access it |

Detailed endpoints are specified in each feature contract (`docs/sprints/sprint-N/F-xx-*.md`).

## 5. Roles, permissions and record access

✔ = allowed · **own** = only records they own (see column "Ownership rule") · ✘ = 403 from the API

| Operation | Endpoint (S1 actual / later planned) | Instructor | Student | Ownership rule |
|---|---|---|---|---|
| Log in | `POST /api/auth/login` | ✔ | ✔ | public |
| Current user / log out | `GET /api/auth/me`, `POST /api/auth/logout` | ✔ | ✔ | own session |
| List my courses | `GET /api/courses` | own | own | instructor: teaches course; student: member of a team in it |
| View course roster | `GET /api/courses/:id/roster` | own | ✘ | `course.instructorId = me` |
| Create / edit draft proposal | F-02 | ✘ | own | member of the team |
| Submit proposal | F-02 | ✘ | own | member of the team (BR-02, BR-03) |
| View team proposal | F-02 | own | own | instructor of the course **or** team member |
| List course proposals | F-02 | own | ✘ | instructor of the course |
| Approve / reject proposal | F-02 | own | ✘ | instructor of the course (BR-03, BR-04) |
| Create / join / leave team | S2 (F-03) | ✘ | ✔ / own | BR-06…BR-08 |
| Manage milestones | S2 (F-04) | own | ✘ | instructor of the course |
| View milestones | S2 (F-04) | own | own | course member |
| Submit deliverable | S2 (F-05) | ✘ | own | team member, BR-10/11 |
| Grade / release | S2 (F-06) | own | ✘ | instructor of the course |
| View released grades | S2 (F-06) | own | own | team member, only after release |
| Peer evaluation | S3 (F-07) | view aggregates (own course) | own ratings only | BR-13 |
| Dashboard, audit log | S3 (F-08, F-09) | own | ✘ | instructor of the course |

**A hidden frontend control is not authorization.** Every row above is enforced by middleware/route code and verified by API tests that call the endpoint directly (e.g. TEST-01-11, TEST-01-12).

## 6. Authentication and session design

| Aspect | Design |
|---|---|
| Credentials | E-mail (trimmed, lower-cased) + password, sent only in the body of `POST /api/auth/login` over HTTPS in production. |
| Password storage | bcrypt hash (`bcryptjs`, cost 10; cost 4 only in automated tests). Plaintext is never stored or logged. |
| Login failure | Unknown e-mail and wrong password give the same `401 INVALID_CREDENTIALS`; bcrypt runs against a dummy hash for unknown e-mails to keep timing similar. |
| Session creation | 32 random bytes (base64url) as the token; a `Session` row stores **SHA-256(token)**, userId and `expiresAt = now + SESSION_TTL_HOURS`. |
| Cookie | `sid=<token>; HttpOnly; SameSite=Lax; Path=/; Max-Age=TTL`; `Secure` when `COOKIE_SECURE=true` (production). JavaScript cannot read it. |
| Current user | `requireAuth` hashes the cookie token, loads the session + user, checks not revoked and not expired, sets `req.user`. `GET /api/auth/me` returns `{id,email,displayName,role}`. |
| Expiry | Fixed 8 h (configurable). Expired sessions → 401; the UI returns to Login. |
| Logout | `POST /api/auth/logout` sets `revokedAt`, clears the cookie, returns 204. The old token is rejected afterwards. |
| CSRF | SameSite=Lax + same-origin JSON API: cross-site form posts do not carry the cookie for `POST`. |
| Future | Login rate limiting and cleanup of expired session rows (Sprint 3 hardening). |

## 7. Configuration and secrets

| Variable | Example (local) | Purpose | Secret? |
|---|---|---|---|
| `DATABASE_URL` | `postgresql://postgres:***@localhost:5432/cpms_dev?schema=public` | Prisma connection | **Yes** |
| `PORT` | `3000` | API port (Cloud Run injects `PORT`) | No |
| `SESSION_TTL_HOURS` | `8` | Session lifetime | No |
| `COOKIE_SECURE` | `false` local / `true` production | Adds `Secure` to the cookie | No |
| `SEED_PASSWORD` | `ChangeMe-local-only` | Password for synthetic seeded accounts | Local only — never used in production |
| `NODE_ENV` | `development` / `test` / `production` | Selects `.env` vs `.env.test`, bcrypt cost | No |

- Local values live in `server/.env` and `server/.env.test`, which are **git-ignored**; `server/.env.example` documents them without secrets.
- The project's `.env` overrides machine-wide variables so a `DATABASE_URL` from another project cannot be used by mistake.
- The client bundle contains **no** configuration secrets; it only calls relative `/api` URLs.
- In production, secrets come from Google Secret Manager as environment variables of the Cloud Run service.

## 8. Deployment design (implemented in Lab 5)

```
 GitHub (main, tags) ──► GitHub Actions: npm ci · migrate test DB · npm test · build image
                                   │
                                   ▼
                       Artifact Registry (Docker image cpms:<git-sha>)
                                   │ deploy
                                   ▼
 Users ──HTTPS──► Cloud Run service "cpms"  ──Cloud SQL connector──► Cloud SQL for PostgreSQL
                  (Express serves /api + built React SPA)           (durable storage, automated backups)
                        ▲
                        └── Secret Manager: DATABASE_URL · Cloud Logging: server logs
```

| Component | Plan |
|---|---|
| Container | Multi-stage Dockerfile: build client (`npm run build`) → Node 20 slim runtime with `server/` + `client/dist`; Express serves static files in production (to be added in Lab 5); `CMD node src/server.js`; listens on `$PORT`. |
| Database | Cloud SQL PostgreSQL; `prisma migrate deploy` runs as a release step before the new revision receives traffic. Seed is **not** run in production except a one-off demo seed. |
| Secrets | `DATABASE_URL` in Secret Manager mounted as env var; service account with least privilege. |
| Health | `GET /api/health` used as the Cloud Run startup/liveness probe. |
| Durability | No local files are written by the app; all state is in PostgreSQL, so containers are stateless and replaceable. |
| CI/CD | Lab 5: tests on every PR to `sprint-*` and `main`; deploy on tag/merge to `main`. |
