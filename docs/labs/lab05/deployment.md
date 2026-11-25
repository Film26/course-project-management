# CPMS — Deployment (Lab 5)

| Item | Value |
|---|---|
| Team | TH-034 · 67070507202 (Film26) · 67070507216 (jaruwan18) |
| Public URL | https://cpms-t4xsm3f7aa-as.a.run.app |
| Running commit | `GET /api/version` (see §6.3) |
| GCP project / region | `cpe334-sec-th-cpms` / `asia-southeast1` |
| Issues | #20–#25, #29 (label `lab5`) · board: https://github.com/users/Film26/projects/13 |

## 1. Stack and changes from the reference

We use the reference stack from the Student Guide / Starter Kit:
**GitHub Actions → Artifact Registry → Cloud Run (service + migration job) → Cloud SQL for PostgreSQL 16**,
runtime secrets in **Secret Manager**, GitHub signs in to GCP with **Workload Identity Federation** (no JSON key).

| Area | Our choice | Difference from the reference / reason |
|---|---|---|
| Image | One multi-stage `node:22-alpine` image: Express serves the built React UI and `/api` on one origin, runs as user `node` | The app is an npm workspace (client + server); same-origin keeps the session cookie first-party (SDS D-07) |
| Migrations | Same image, command `migrate` = `prisma migrate deploy` + idempotent seed, run as Cloud Run job `cpms-migrate` before the service is updated | Prisma instead of the kit's ORM |
| Health | `/api/health` (process), `/api/ready` (DB reachable), `/api/version` (running commit) | — |
| Scaling | Cloud Run min 0 / **max 2** instances | Lower max than the kit's 3 to cap cost |
| Deploy scripts | `deploy/deploy.sh` (one-time setup + first deploy), `deploy/release.sh` (one release, used by `deploy.yml`), `deploy/smoke_test.sh` | Adapted from the kit; names in `deploy/config.sh` |

## 2. Environment variables

Every setting comes from the environment (R-02). No real value is committed: `.env` files are git-ignored and
excluded from the image by `.dockerignore`. Placeholders are in [`.env.example`](../../../.env.example)
(Docker) and [`server/.env.example`](../../../server/.env.example) (without Docker).

| Variable | Purpose | Secret? | Local value comes from | Cloud Run value comes from |
|---|---|---|---|---|
| `DATABASE_URL` | Prisma connection string | **Yes** | `server/.env` / built by `docker-compose.yml` from `POSTGRES_PASSWORD` | Secret Manager `cpms-database-url` (Cloud SQL socket `/cloudsql/cpe334-sec-th-cpms:asia-southeast1:cpms-pg`) |
| `SEED_PASSWORD` | Password of the synthetic demo accounts (`instructor1@cpms.test`, `student1..3@cpms.test`); used only by the seed | **Yes** | `.env` | Secret Manager `cpms-seed-password` (migration job only) |
| `POSTGRES_PASSWORD` | Password of the local PostgreSQL container | **Yes** | `.env` (compose only) | not used |
| `PORT` | HTTP port | No | `3000` (dev) / `8080` (image) | injected by Cloud Run |
| `NODE_ENV` | `development` / `test` / `e2e` / `production` | No | npm scripts | `production` |
| `SESSION_TTL_HOURS` | Session lifetime | No | default `8` | `8` (deploy.sh) |
| `COOKIE_SECURE` | Adds `Secure` to the session cookie | No | `false` (http) | `true` (https) |
| `CLIENT_DIST_DIR` | Folder of the built UI served by Express | No | unset in dev (Vite serves the UI) | `/app/client/dist` (Dockerfile) |
| `APP_COMMIT` | Commit shown at `/api/version` (R-08) | No | `local` | full commit SHA (build arg + `--update-env-vars`) |
| `SEED_ON_MIGRATE` | Run the seed after migrations | No | default `true` | default `true` |
| `TZ` | Time zone for logs | No | — | `Asia/Bangkok` |

Pipeline values are **GitHub environment `demo` variables** (not secrets, deploys allowed from `main` only):
`GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA`.

## 3. Commands

```bash
# Build, test, run without Docker (see README "Local setup")
npm install
npm test                 # unit + API/DB integration tests (cpms_test)
npm run build            # production build of the UI
npm run db:migrate       # prisma migrate deploy
npm run db:seed          # idempotent synthetic seed

# Docker (fresh clone, C-03)
cp .env.example .env     # set POSTGRES_PASSWORD and SEED_PASSWORD
docker compose up --build -d    # db -> migrate (exits 0) -> app on http://localhost:8080
docker compose ps -a
curl http://localhost:8080/api/ready

# Cloud: migrate + seed on demand (same as every release)
gcloud run jobs execute cpms-migrate --region asia-southeast1 --wait
```

## 4. GCP resources

| Resource | Name | Notes |
|---|---|---|
| Project | `cpe334-sec-th-cpms` (region `asia-southeast1`) | Free Trial, alerts-only budget; teammate has Editor |
| Artifact Registry | `cpms` (Docker) → image `cpms`, tag = full commit SHA | |
| Cloud Run service | `cpms` | public, min 0 / max 2, 512 MiB, label `commit-sha` |
| Cloud Run job | `cpms-migrate` | `migrate` command, runs before each release |
| Cloud SQL | `cpms-pg`, PostgreSQL 16, `db-f1-micro`, 10 GB HDD, no storage auto-increase, database `cpms`, user `cpms_app` | all data, including sessions |
| Secret Manager | `cpms-database-url`, `cpms-seed-password` | readable only by `cpms-runner` |
| Runtime SA | `cpms-runner` | `cloudsql.client`, `secretAccessor` on the two secrets |
| Deploy SA | `cpms-deployer` | `run.developer`, `artifactregistry.writer`, `serviceAccountUser` on `cpms-runner` |
| WIF | pool `github-pool`, provider `github-provider` | accepts only `Film26/course-project-management` on `refs/heads/main` |

## 5. Quality gate

- `.github/workflows/ci-docker.yml`, job **`test-and-docker`**, runs on every PR into `staging` and `main`:
  deploy-script dry run → migrate + seed twice on a throwaway PostgreSQL → `npm test` → UI build →
  `docker build` → run the container and smoke-test it.
- Ruleset **lab5-merge-gate** on `main` and `staging`: PR required, 1 approval (the author cannot approve),
  required check `test-and-docker`, no force push, no deletion, no bypass.

## 6. Release procedure

### 6.1 Normal release (repeatable)

1. Open an Issue with label `lab5`; create a `feature/…` or `fix/…` branch from `staging`.
2. Open a PR into `staging`; `test-and-docker` must pass and the **teammate** approves with a specific review.
3. Merge into `staging`.
4. Open a release PR `staging → main`; CI passes again and the teammate approves; merge.
5. The push to `main` starts **Deploy demo** (`.github/workflows/deploy.yml`):
   test again → WIF sign-in → `docker build` + push `…/cpms/cpms:<full SHA>` →
   `deploy/release.sh <SHA>`: resolve the digest → update + run `cpms-migrate` → deploy `cpms` **by digest**
   with `APP_COMMIT=<SHA>` and label `commit-sha=<SHA>` → smoke test of the public URL (expects `/api/version` = SHA).
6. Check the run summary (commit, digest, revision, URL).

### 6.2 First deploy / re-create resources

From Cloud Shell in a clone at `main`:

```bash
export PROJECT_ID=cpe334-sec-th-cpms REGION=asia-southeast1
DRY_RUN=1 bash deploy/deploy.sh   # read every command first
bash deploy/deploy.sh             # idempotent: existing resources are skipped
```

### 6.3 Which commit is running

```bash
curl https://cpms-t4xsm3f7aa-as.a.run.app/api/version          # {"commit":"<SHA>"}
gcloud run services describe cpms --region asia-southeast1 \
  --format='value(status.latestReadyRevisionName,metadata.labels.commit-sha)'
```

The SHA equals the merge commit on `main`, the image tag and the Deploy demo summary.

### 6.4 Roll back and roll forward

Actions → **Deploy demo** → *Run workflow* on `main` with `image_tag` = the full SHA of an earlier release.
Test and build are skipped and that exact image is redeployed (migrations must stay additive).
Roll forward the same way with the newer SHA, or merge a fix through the normal procedure.

## 7. Cost control

Alerts-only budget created before any resource · Cloud Run min 0 instances · smallest Cloud SQL tier, storage
auto-increase off · nothing else billable. Keep the service running until grading ends, then delete `cpms-pg`
(and the project) when the course is over.

## 8. Evidence (Lab 5 checks)

| Check | Evidence |
|---|---|
| C-01 | PR #19, run [43691606004](https://github.com/Film26/course-project-management/actions/runs/43691606004): 67/67 tests, Docker build + container smoke test |
| C-02 | PR #27 (temporary branch, one failing test), run [43743335851](https://github.com/Film26/course-project-management/actions/runs/43743335851): check failed, merge blocked; closed unmerged |
| C-03 | PR #17: fresh clone → `docker compose up --build -d` → migrate Exited (0) → app serves UI and API |
| C-04 | Public URL: sign in, proposal created/submitted/approved, reject without reason refused, student gets 403 on roster |
| C-05 | Proposal “Lab 5 Persistence Check” present after restart (revision `cpms-00002-s67`) and after redeploy (`cpms-00003-h49`) — Issue #25 |
| C-06 | PR #28 → staging, release PR #30 → main (merge `c83a17a`), Deploy demo run [43922898309](https://github.com/Film26/course-project-management/actions/runs/43922898309): digest `sha256:5b5384fc…`, revision `cpms-00003-h49`, `/api/version` = `c83a17a…` |

## 9. Later releases through the same pipeline (Lab 6)

Every release below went `staging` → `main` through a reviewed PR and was deployed by the Deploy demo workflow (§6). Revisions are read from the deploy run log.

| Release PR → main | Commit | Deploy demo run | Revision | Content |
|---|---|---|---|---|
| #30 | `c83a17a` | [43922898309](https://github.com/Film26/course-project-management/actions/runs/43922898309) | `cpms-00003-h49` | Lab 5 deploy pipeline (C-06); Sprint 1 UAT round 1 tested this release |
| #35 | `8e89112` | [44699936362](https://github.com/Film26/course-project-management/actions/runs/44699936362) | `cpms-00004-m7f` | Lab 6 controlled defect exercise build (PR #34); UAT round 2 found #36 here |
| #38 | `463411f` | [45229209859](https://github.com/Film26/course-project-management/actions/runs/45229209859) | `cpms-00005-zns` | Fix for #36 (PR #37); current deployed release |
