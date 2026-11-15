#!/usr/bin/env bash
# Release one image to Cloud Run (Lab 5 Ep.7, R-07/R-08). Called by .github/workflows/deploy.yml.
#   PROJECT_ID=... REGION=... bash deploy/release.sh <full 40-char commit SHA>
# 1) resolve the image tag (= commit SHA) to its digest, 2) run the migration job with that image,
# 3) deploy the service by digest with APP_COMMIT + label commit-sha, 4) print the service URL.
set -euo pipefail
cd "$(dirname "$0")/.."
# shellcheck source=deploy/config.sh
source deploy/config.sh

: "${PROJECT_ID:?set PROJECT_ID}"
TAG="${1:?usage: release.sh <full 40-character commit SHA>}"
if ! [[ "$TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Image tag must be a full 40-character commit SHA, got: ${TAG}" >&2
  exit 1
fi

BASE="$(image_base)"
if [ "${DRY_RUN:-0}" = "1" ]; then
  DIGEST="sha256:dry-run"
else
  DIGEST="$(gcloud artifacts docker images describe "${BASE}:${TAG}" --format='value(image_summary.digest)')"
fi
[ -n "$DIGEST" ] || { echo "Image digest not found for ${BASE}:${TAG}" >&2; exit 1; }
REF="${BASE}@${DIGEST}"
echo "Releasing ${TAG} as ${REF}"

run gcloud run jobs update "$MIGRATE_JOB_NAME" --image "$REF" --region "$REGION" --project "$PROJECT_ID" --quiet
run gcloud run jobs execute "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --wait

run gcloud run deploy "$SERVICE_NAME" --image "$REF" --region "$REGION" --project "$PROJECT_ID" \
  --update-env-vars "APP_COMMIT=${TAG}" --update-labels "commit-sha=${TAG}" --quiet

if [ "${DRY_RUN:-0}" = "1" ]; then
  URL="https://dry-run.example"; REVISION="dry-run"
else
  URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
  REVISION="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" \
    --format='value(status.latestReadyRevisionName)')"
fi

# Outputs for the workflow summary (ignored when run by hand).
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  { echo "url=${URL}"; echo "digest=${DIGEST}"; echo "revision=${REVISION}"; } >> "$GITHUB_OUTPUT"
fi
echo "Released ${TAG} -> ${URL} (revision ${REVISION})"
