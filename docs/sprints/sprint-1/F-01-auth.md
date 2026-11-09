# F-01 Authentication & Role-Based Access — Engineering Contract

| Item | Value |
|---|---|
| Feature | F-01 Authentication & Role-Based Access |
| Sprint | 1 |
| GitHub Issue | #1 |
| Branch | `feature/F-01-auth` (from `sprint-1`) |
| Owner / reviewer | Film26 / jaruwan18 |
| Linked requirements | FR-01, FR-02, FR-03, FR-04, NFR-01, NFR-02, NFR-03, NFR-04 |
| Depends on | Baseline scaffold (User, Session, Course, Team, TeamMember tables + seed) |
| Used by | F-02 Project Proposal Workflow (`requireAuth`, `requireRole`, current user) |

## Version history

| Version | Date | Author | Change | Reason |
|---|---|---|---|---|
| 1.0 | 2026-11-07 | Film26 | Initial contract: design, API, AC, STS | Written before implementation |
| 1.1 | 2026-11-07 | Film26 | Added `GET /api/courses`, AC-01-11, TEST-01-14 | During UI work the Home page needed the current user's courses to link to the roster; scoped by the session user, no new data |

## 1. Linked requirements (summary — full text in `docs/srs.md`)

| ID | Requirement |
|---|---|
| FR-01 | A seeded user can log in with email and password and receives an authenticated session. |
| FR-02 | A logged-in user can log out; the session can no longer be used afterwards. |
| FR-03 | The system returns the current user's identity and role from the session (never from client input). |
| FR-04 | An Instructor can view the roster (teams and members) of a course they teach. |
| NFR-01 | Passwords are stored only as bcrypt hashes (cost ≥ 10 in production) and never returned by any API. |
| NFR-02 | An unauthenticated request to a protected endpoint is rejected with 401 and returns no private data. |
| NFR-03 | Role and ownership are enforced in the backend; a forbidden operation returns 403 and no private data. |
| NFR-04 | Sessions expire after `SESSION_TTL_HOURS` (default 8 h); an expired or revoked session is rejected. |

## 2. Behaviour and workflow

```
Login page ──POST /api/auth/login──► verify email + bcrypt hash
   │                                   ├─ fail → 401 INVALID_CREDENTIALS (same message for unknown email / wrong password)
   │                                   └─ ok  → create Session(tokenHash, expiresAt) → Set-Cookie sid=<token>
   ▼
Home (header: name + role) ──GET /api/auth/me──► requireAuth → user from session
   │
   ├─ Instructor opens course roster ──GET /api/courses/:courseId/roster──► requireAuth → requireRole(INSTRUCTOR) → owns course?
   │
   └─ Logout ──POST /api/auth/logout──► Session.revokedAt = now, clear cookie → back to Login page
```

### Business / security rules
- **R1** Unknown email and wrong password produce the *same* 401 response (no account enumeration).
- **R2** A session is active only if `revokedAt IS NULL` and `now < expiresAt` (boundary: `now == expiresAt` → expired).
- **R3** The session token is 32 random bytes (base64url). Only its SHA-256 hash is stored in the database.
- **R4** Identity and role always come from the session lookup. Request bodies, query strings or headers that claim a user ID or role are ignored.
- **R5** `requireRole(role)` returns 403 when the authenticated user has a different role.
- **R6** Course roster: only the Instructor whose `Course.instructorId` equals the current user may read it (ownership). Another Instructor → 403. Unknown course → 404.

### Validation
- `email`: required, string, trimmed, lower-cased, ≤ 254 chars, contains `@`.
- `password`: required, string, 1–128 chars.
- Invalid or missing fields → 400 `VALIDATION_ERROR` with `details` listing the fields (no lookup performed).

## 3. API contract

All errors use `{ "error": { "code": string, "message": string, "details"?: object } }`.

| Method & path | Auth | Request | Success | Errors |
|---|---|---|---|---|
| `POST /api/auth/login` | public | `{ "email", "password" }` | `200 { "user": { id, email, displayName, role } }` + `Set-Cookie: sid=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=TTL` (`Secure` when `COOKIE_SECURE=true`) | 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` |
| `POST /api/auth/logout` | session | — | `204`, session revoked, cookie cleared | 401 `UNAUTHENTICATED` |
| `GET /api/auth/me` | session | — | `200 { "user": { id, email, displayName, role } }` | 401 `UNAUTHENTICATED` |
| `GET /api/courses` *(v1.1)* | session | — | `200 { "courses": [ { id, code, name } ] }` — INSTRUCTOR: courses they teach; STUDENT: courses of teams they belong to | 401 `UNAUTHENTICATED` |
| `GET /api/courses/:courseId/roster` | session, INSTRUCTOR, owns course | — | `200 { "course": { id, code, name }, "teams": [ { id, name, members: [ { id, displayName, email } ] } ] }` | 400 `VALIDATION_ERROR` (non-integer id), 401, 403 `FORBIDDEN`, 404 `NOT_FOUND` |

`passwordHash` and `tokenHash` never appear in any response.

### Application-layer components (server)
| Module | Responsibility |
|---|---|
| `src/auth/password.js` | `hashPassword`, `verifyPassword` (bcryptjs) |
| `src/auth/session.js` | `newToken`, `hashToken`, `isSessionActive(session, now)`, create / find / revoke session |
| `src/auth/middleware.js` | `requireAuth` (sets `req.user`), `requireRole(role)` |
| `src/routes/auth.js` | login, logout, me |
| `src/routes/courses.js` | roster (role + ownership check) |

## 4. Data
- Uses `User` and `Session` from the baseline migration `20261107000000_init`. **No new migration.**
- `Session`: `tokenHash` unique, `userId` FK (cascade delete), `expiresAt` not null, `revokedAt` nullable.
- Seed: `instructor1@cpms.test` (INSTRUCTOR), `student1..3@cpms.test` (STUDENT); password from `SEED_PASSWORD`.

## 5. UI
| Screen / element | Behaviour |
|---|---|
| Login page | Email + password fields, required-field validation before submit, button disabled + "Signing in…" while loading, error banner with server message on 401/400. |
| App header (logged in) | Shows `displayName` and role badge from `/api/auth/me`; Logout button. |
| Session restore | On load, call `/api/auth/me`; 401 → show Login page; loading state while checking. |
| Course roster (Instructor only) | Lists teams and members of CPE334; empty state "No teams yet"; 403 shows "You do not have access to this course". Students do not see the link — **the backend still enforces 403**. |
| Logout | Calls `/api/auth/logout`, returns to Login page; Back button does not restore protected data (next `/me` → 401). |

## 6. Acceptance criteria

| AC | Given / When / Then | Reqs |
|---|---|---|
| AC-01-01 | Given a seeded user, when they POST valid credentials, then 200 with `{user:{id,email,displayName,role}}`, an HttpOnly `sid` cookie is set, and the response has no `passwordHash`. | FR-01, NFR-01 |
| AC-01-02 | When the password is wrong **or** the email is unknown, then 401 `INVALID_CREDENTIALS` with identical message, no cookie set, no session row created. | FR-01, R1 |
| AC-01-03 | When email or password is missing/empty/not a string, then 400 `VALIDATION_ERROR` listing the field(s). | FR-01 |
| AC-01-04 | Given a valid session, `GET /api/auth/me` returns the session's user; a `userId`/`role` sent by the client is ignored. | FR-03, R4 |
| AC-01-05 | Without a cookie, with an unknown token, or with an expired session, protected endpoints return 401 `UNAUTHENTICATED` and no user/course data. | NFR-02, NFR-04, R2 |
| AC-01-06 | After `POST /api/auth/logout` (204), reusing the old cookie returns 401; the session row has `revokedAt` set. | FR-02 |
| AC-01-07 | A STUDENT calling `GET /api/courses/:id/roster` gets 403 `FORBIDDEN` with no roster data. | NFR-03, R5 |
| AC-01-08 | The course's Instructor gets 200 with teams and members; a different Instructor gets 403; an unknown course gets 404. | FR-04, R6 |
| AC-01-09 | Stored passwords are bcrypt hashes, not plaintext; tokens are stored only as SHA-256 hashes. | NFR-01, R3 |
| AC-01-11 *(v1.1)* | `GET /api/courses` returns only courses the session user teaches (INSTRUCTOR) or belongs to through a team (STUDENT); unauthenticated → 401. | FR-03, NFR-03 |
| AC-01-10 | UI: a user logs in, sees their name and role, (Instructor) opens the roster, logs out and is returned to the Login page; invalid login shows an error message. | FR-01–FR-04 |

## 7. Software Test Specification

| Test ID | AC | Level | Precondition / input | Action | Expected result |
|---|---|---|---|---|---|
| TEST-01-01 | AC-01-05 | Unit | session `{revokedAt:null, expiresAt: now+1ms}` / `expiresAt: now` / `revokedAt` set | `isSessionActive(s, now)` | true / **false (boundary)** / false |
| TEST-01-02 | AC-01-09 | Unit | password `"S3cret!"` | `hashPassword` then `verifyPassword` | hash ≠ plaintext, starts with `$2`; correct → true, wrong → false |
| TEST-01-03 | AC-01-09 | Unit | token from `newToken()` | `hashToken(token)` | 64-char hex, deterministic, ≠ token |
| TEST-01-04 | AC-01-01, AC-01-09 | API+DB | user exists | POST login with valid credentials | 200, body user fields only, HttpOnly `sid` cookie, 1 session row whose `tokenHash` ≠ cookie value |
| TEST-01-05 | AC-01-02 | API+DB | user exists | POST login wrong password; POST login unknown email | both 401 `INVALID_CREDENTIALS`, same message, no cookie, 0 session rows |
| TEST-01-06 | AC-01-03 | API | — | POST login `{}` and `{email:"a@b.c", password:""}` | 400 `VALIDATION_ERROR`, `details` names the fields |
| TEST-01-07 | AC-01-04 | API+DB | logged in as student1 | GET `/api/auth/me?userId=<instructor id>` with header `X-User-Role: INSTRUCTOR` | 200, returns student1 with role STUDENT |
| TEST-01-08 | AC-01-05 | API | no cookie; random cookie | GET `/api/auth/me`, GET roster | 401 `UNAUTHENTICATED`, body has no `user`/`teams` |
| TEST-01-09 | AC-01-05 | API+DB | logged in, then session `expiresAt` set to the past in DB | GET `/api/auth/me` | 401 `UNAUTHENTICATED` |
| TEST-01-10 | AC-01-06 | API+DB | logged in | POST logout, then GET `/api/auth/me` with same cookie | 204; then 401; session `revokedAt` not null |
| TEST-01-11 | AC-01-07 | API+DB | course + team seeded, logged in as student | GET `/api/courses/:id/roster` | 403 `FORBIDDEN`, no `teams` |
| TEST-01-12 | AC-01-08 | API+DB | course owned by instructor A, instructor B exists | GET roster as A; as B; unknown id as A | 200 with team + members (no password hashes); 403; 404 |
| TEST-01-14 *(v1.1)* | AC-01-11 | API+DB | course taught by A with student in a team; instructor B | GET `/api/courses` as A, student, B, anonymous | A and student: `[CPE334]`; B: `[]`; anonymous: 401 |
| TEST-01-13 | AC-01-10, AC-01-02 | E2E (Playwright) | seeded DB, API + UI running | Invalid login → error shown; login as instructor1 → header shows name/INSTRUCTOR → open roster → logout | Error banner; header correct; roster lists Team Alpha; back on Login page |

## 8. Definition of Done (F-01 instance of the Product DoD)
- [ ] All AC-01-01 … AC-01-11 implemented.
- [ ] TEST-01-01 … TEST-01-14 automated and passing; red → green evidence kept for TEST-01-01, TEST-01-05, TEST-01-11.
- [ ] No secrets in Git; `.env.example` current; README setup still works from a clean clone.
- [ ] PR into `sprint-1` reviewed and approved by jaruwan18 with a specific review comment.
- [ ] Contract updated (version history) if behaviour changed during implementation.
- [ ] Known gaps disclosed in the PR and in Deliverable Part F.
