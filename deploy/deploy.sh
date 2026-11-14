#!/usr/bin/env bash
# One-time setup + first deploy of CPMS to Google Cloud (Lab 5 Ep.5). Run from Cloud Shell
# in a clone of the repo at the latest main:
#   DRY_RUN=1 PROJECT_ID=your-project REGION=asia-southeast1 bash deploy/deploy.sh   # print only
#   PROJECT_ID=your-project REGION=asia-southeast1 bash deploy/deploy.sh             # for real
# Safe to run again: every resource is skipped if it already exists.
# Passwords are generated here and stored only in Secret Manager; they are never printed.
# Cost starts here (Cloud SQL is billed per hour). Make sure the budget alert exists first.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/config.sh
source deploy/config.sh

: "${PROJECT_ID:?set PROJECT_ID (your GCP Project ID)}"
DRY="${DRY_RUN:-0}"
exists() { [ "$DRY" != "1" ] && "$@" >/dev/null 2>&1; }
step() { printf '\n== %s\n' "$*"; }
gen_password() { openssl rand -base64 36 | tr -d '/+=\n' | head -c 32; }

TAG="$(git rev-parse HEAD)"
IMAGE="$(image_base):${TAG}"
RUNNER="$(runner_sa_email)"
CONN="$(sql_connection)"

if [ "$DRY" != "1" ] && [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean: deploy only committed code (git status)." >&2
  exit 1
fi
run gcloud config set project "$PROJECT_ID"

step "1/8 Enable APIs"
run gcloud services enable run.googleapis.com sqladmin.googleapis.com artifactregistry.googleapis.com \
  cloudbuild.googleapis.com secretmanager.googleapis.com iam.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com

step "2/8 Artifact Registry repository ${REPO_NAME}"
if exists gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION"; then
  echo "exists, skipped"
else
  run gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker \
    --location "$REGION" --description "CPMS images (tag = full commit SHA)"
fi

step "3/8 Cloud SQL ${SQL_INSTANCE} (PostgreSQL 16, smallest tier, 10 GB, no auto-increase) and database ${DB_NAME}"
if exists gcloud sql instances describe "$SQL_INSTANCE"; then
  echo "instance exists, skipped"
else
  run gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise \
    --tier=db-f1-micro --region "$REGION" --storage-size=10GB --storage-type=HDD \
    --no-storage-auto-increase --availability-type=zonal
fi
if exists gcloud sql databases describe "$DB_NAME" --instance "$SQL_INSTANCE"; then
  echo "database exists, skipped"
else
  run gcloud sql databases create "$DB_NAME" --instance "$SQL_INSTANCE"
fi

step "4/8 Runtime service account ${RUNNER_SA_NAME} with Cloud SQL Client"
if exists gcloud iam service-accounts describe "$RUNNER"; then
  echo "exists, skipped"
else
  run gcloud iam service-accounts create "$RUNNER_SA_NAME" --display-name "CPMS runtime (Cloud Run)"
fi
run gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:${RUNNER}" \
  --role roles/cloudsql.client --condition=None --quiet >/dev/null

step "5/8 Database user + secrets ${SECRET_DB_URL}, ${SECRET_SEED} (generated, never printed)"
if exists gcloud secrets describe "$SECRET_DB_URL"; then
  echo "${SECRET_DB_URL} exists, skipped (rotate: gcloud sql users set-password + new secret version)"
else
  DB_PASS="$(gen_password)"
  if exists gcloud sql users describe "$DB_USER" --instance "$SQL_INSTANCE"; then
    run gcloud sql users set-password "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS"
  else
    run gcloud sql users create "$DB_USER" --instance "$SQL_INSTANCE" --password "$DB_PASS"
  fi
  DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${CONN}&schema=public"
  if [ "$DRY" = "1" ]; then
    echo "+ gcloud secrets create ${SECRET_DB_URL} --data-file=- (value hidden)"
  else
    printf '%s' "$DB_URL_VALUE" | gcloud secrets create "$SECRET_DB_URL" --replication-policy=automatic --data-file=-
  fi
  unset DB_PASS DB_URL_VALUE
fi
if exists gcloud secrets describe "$SECRET_SEED"; then
  echo "${SECRET_SEED} exists, skipped"
elif [ "$DRY" = "1" ]; then
  echo "+ gcloud secrets create ${SECRET_SEED} --data-file=- (value hidden)"
else
  gen_password | gcloud secrets create "$SECRET_SEED" --replication-policy=automatic --data-file=-
fi
for s in "$SECRET_DB_URL" "$SECRET_SEED"; do
  run gcloud secrets add-iam-policy-binding "$s" --member "serviceAccount:${RUNNER}" \
    --role roles/secretmanager.secretAccessor --quiet >/dev/null
done

step "6/8 Build and push ${IMAGE}"
run gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
run docker build --build-arg APP_COMMIT="$TAG" -t "$IMAGE" .
run docker push "$IMAGE"

step "7/8 Migration job ${MIGRATE_JOB_NAME} (prisma migrate deploy + idempotent seed)"
JOB_FLAGS=(--image "$IMAGE" --region "$REGION" --service-account "$RUNNER"
  --set-cloudsql-instances "$CONN"
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,SEED_PASSWORD=${SECRET_SEED}:latest"
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok" --args migrate
  --max-retries 0 --task-timeout 600s --memory 512Mi)
if exists gcloud run jobs describe "$MIGRATE_JOB_NAME" --region "$REGION"; then
  run gcloud run jobs update "$MIGRATE_JOB_NAME" "${JOB_FLAGS[@]}" --quiet
else
  run gcloud run jobs create "$MIGRATE_JOB_NAME" "${JOB_FLAGS[@]}" --quiet
fi
if ! run gcloud run jobs execute "$MIGRATE_JOB_NAME" --region "$REGION" --wait; then
  echo "Migration failed. Read the log:" >&2
  echo "  gcloud logging read 'resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}' --limit 50 --freshness 1h" >&2
  exit 1
fi

step "8/8 Cloud Run service ${SERVICE_NAME} (public, min 0 / max 2 instances)"
run gcloud run deploy "$SERVICE_NAME" --image "$IMAGE" --region "$REGION" \
  --service-account "$RUNNER" --add-cloudsql-instances "$CONN" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok,COOKIE_SECURE=true,SESSION_TTL_HOURS=8,APP_COMMIT=${TAG}" \
  --update-labels "commit-sha=${TAG}" \
  --min-instances 0 --max-instances 2 --memory 512Mi --cpu 1 \
  --allow-unauthenticated --quiet

if [ "$DRY" = "1" ]; then
  echo; echo "Dry run only: nothing was created."
else
  URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format='value(status.url)')"
  echo; echo "Deployment completed: ${URL}  (commit ${TAG})"
  echo "Seeded demo accounts use the password in secret ${SECRET_SEED}; read it privately with:"
  echo "  gcloud secrets versions access latest --secret=${SECRET_SEED}"
fi
