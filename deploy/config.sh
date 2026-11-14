# Shared resource names for the CPMS deployment (Lab 5). Sourced by deploy.sh, release.sh, teardown.sh.
# The same names are used in .github/workflows/deploy.yml and docs/labs/lab05/deployment.md.
# None of these values is secret. PROJECT_ID and REGION come from the environment.
# shellcheck shell=bash disable=SC2034

APP=cpms
SERVICE_NAME="${SERVICE_NAME:-cpms}"                # Cloud Run service (UI + API)
MIGRATE_JOB_NAME="${MIGRATE_JOB_NAME:-cpms-migrate}" # Cloud Run job: prisma migrate deploy + seed
REPO_NAME="${REPO_NAME:-cpms}"                      # Artifact Registry repository
IMAGE_NAME="${IMAGE_NAME:-cpms}"                    # image inside that repository
SQL_INSTANCE="${SQL_INSTANCE:-cpms-pg}"             # Cloud SQL for PostgreSQL instance
DB_NAME="${DB_NAME:-cpms}"
DB_USER="${DB_USER:-cpms_app}"
SECRET_DB_URL="${SECRET_DB_URL:-cpms-database-url}"     # DATABASE_URL
SECRET_SEED="${SECRET_SEED:-cpms-seed-password}"        # SEED_PASSWORD (demo accounts for UAT)
RUNNER_SA_NAME="${RUNNER_SA_NAME:-cpms-runner}"         # identity of the running app and job

REGION="${REGION:-asia-southeast1}"

image_base() {
  echo "${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${IMAGE_NAME}"
}
runner_sa_email() {
  echo "${RUNNER_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
}
sql_connection() {
  echo "${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
}

# DRY_RUN=1 prints every command instead of running it.
run() {
  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '+ %s\n' "$*"
  else
    "$@"
  fi
}
