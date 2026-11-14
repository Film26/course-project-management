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

## Run with Docker (Lab 5)

Prerequisites: Docker Desktop (or Docker Engine + Compose v2). No Node.js or PostgreSQL install needed.

```bash
cp .env.example .env              # set POSTGRES_PASSWORD and SEED_PASSWORD (your own values)
docker compose up --build -d      # db -> migrate (migrations + seed, exits 0) -> app
docker compose ps -a              # app and db running, migrate "Exited (0)"
curl http://localhost:8080/api/ready     # {"status":"ready","db":"connected"}
curl http://localhost:8080/api/version   # commit the image was built from
# open http://localhost:8080 and log in with a seeded account (password = SEED_PASSWORD)

docker compose down               # stop; data stays in the pgdata volume
docker compose up -d              # start again; your data is still there
docker compose down -v            # stop AND delete the database volume
```

The same image runs on Cloud Run: `serve` (default) starts the API and serves the built UI on one
origin; `migrate` applies Prisma migrations and the idempotent seed. Port 8080 already in use?
Set `APP_PORT=8081` in `.env`. On Windows PowerShell type `curl.exe` instead of `curl`.

## Local setup

Prerequisites: Node.js 20+, PostgreSQL running locally.

```bash
npm install                                   # installs server + client workspaces

# Environment — copy and edit (put your own local PostgreSQL password)
cp server/.env.example server/.env            # DATABASE_URL -> .../cpms_dev
cp server/.env.example server/.env.test       # change database name to cpms_test
cp server/.env.example server/.env.e2e        # change database name to cpms_e2e and PORT to 3100 (Playwright only)

npm run db:migrate                            # apply migrations to cpms_dev
npm run db:seed                               # synthetic accounts + course + teams

npm run dev:server                            # API  -> http://localhost:3000
npm run dev:client                            # UI   -> http://localhost:5173
```

### Test and build

```bash
npm test          # server unit + API/DB integration tests (uses cpms_test, migrated automatically)
npm run build     # production build of the client
npm run test:e2e  # Playwright UI journeys against the separate cpms_e2e database (never cpms_dev):
                  # starts its own API on :3100 (migrate + seed cpms_e2e first) and UI on :5174
                  # needs: database cpms_e2e created + server/.env.e2e
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
