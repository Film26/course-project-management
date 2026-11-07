# Course Project Management System

CPE 334 group project — a system for instructors and students to manage course projects
(teams, project proposals, review and approval).

## Branching workflow

| Branch | Purpose |
|---|---|
| `main` | Accepted releases only (tagged, e.g. `v1.0-sprint1`) |
| `sprint-1` | Sprint 1 staging / integration branch |
| `feature/F-xx-short-name` | Feature work, branched from the current sprint branch |

1. Pick or open a GitHub Issue for the feature (`F-xx`).
2. Branch from `sprint-1`: `git switch sprint-1 && git pull && git switch -c feature/F-01-auth`
3. Commit the feature contract (spec / AC / STS) **before** implementation.
4. Open a PR into `sprint-1`, link the Issue (`Closes #n`), and request review from your teammate.
   Authors never approve their own PRs.
5. After Sprint 1 integration and acceptance checks, open a release PR `sprint-1` → `main` and tag it.

## Documentation

See [`docs/`](docs/) — SRS, features, traceability, system SDS, sprint plan and Sprint 1 contracts.

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 + Vite (`client/`) — proxies `/api` to the API in development |
| API / application | Node.js 20+ + Express 5 (`server/src/`) |
| Database | PostgreSQL 15+ via Prisma 6 (schema, migrations, seed in `server/prisma/`) |
| Auth | bcrypt password hashes, server-side sessions in an httpOnly cookie |
| Tests | Vitest + Supertest (unit, API/DB integration), Playwright (E2E) |

## Local setup

Prerequisites: Node.js 20+, PostgreSQL running locally.

```bash
npm install                                   # installs server + client workspaces

# Environment — copy and edit (put your own local PostgreSQL password)
cp server/.env.example server/.env            # DATABASE_URL -> .../cpms_dev
cp server/.env.example server/.env.test       # change database name to cpms_test

npm run db:migrate                            # apply migrations to cpms_dev
npm run db:seed                               # synthetic accounts + course + teams

npm run dev:server                            # API  -> http://localhost:3000
npm run dev:client                            # UI   -> http://localhost:5173
```

### Test and build

```bash
npm test          # server unit + API/DB integration tests (uses cpms_test, migrated automatically)
npm run build     # production build of the client
npm run test:e2e  # Playwright UI journeys (needs db:migrate + db:seed; starts API and UI automatically)
                  # note: the F-02 journey deletes the proposals of the seeded CPE334 course in cpms_dev first
                  # first time only: npx playwright install chromium
```

### Seeded accounts (synthetic, local only)

All accounts use the password set in `SEED_PASSWORD` in `server/.env`.

| Email | Role | Team |
|---|---|---|
| instructor1@cpms.test | INSTRUCTOR | teaches CPE334 |
| student1@cpms.test | STUDENT | Team Alpha |
| student2@cpms.test | STUDENT | Team Alpha |
| student3@cpms.test | STUDENT | Team Beta |

### Sprint 1 journey (F-01 + F-02)

1. Log in as `student3@cpms.test` → **My team proposal** → create a draft → **Submit proposal**.
2. Log in as `instructor1@cpms.test` → **Review proposals** → **Approve**, or **Reject** with a reason.
3. Log in as the student again → the status and the decision/reason are shown; after a rejection the team can create a new proposal.

Rules enforced by the API: one active proposal per team, no submission after the course deadline,
only `DRAFT→SUBMITTED→APPROVED|REJECTED`, a reason (≤ 500 chars) on reject, and only team members /
the course instructor can act (see `docs/sprints/sprint-1/F-02-proposal.md`).

Never commit `server/.env` / `server/.env.test` or any real password.
