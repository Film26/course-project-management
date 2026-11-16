#!/usr/bin/env bash
# Read-only smoke test of a running CPMS (Lab 5 Ep.7). Used by CI against the local container and by
# deploy.yml against the public Cloud Run URL after every release.
#   bash deploy/smoke_test.sh <base URL> [expected commit SHA]
# Optional login check: set both SMOKE_EMAIL and SMOKE_PASSWORD (a low-privilege test account),
# or neither (prints SKIP login). Never use the instructor/admin account.
set -euo pipefail
BASE="${1:?usage: smoke_test.sh <base URL> [expected commit]}"
BASE="${BASE%/}"
EXPECT_COMMIT="${2:-}"
FAILS=0
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# get <path> <expected status> <text the body must contain>
check() {
  local path="$1" want_status="$2" want_text="$3" status
  rm -f "$TMP/body"
  status="$(curl -sS -o "$TMP/body" -w '%{http_code}' --retry 6 --retry-all-errors --retry-delay 5 \
    --max-time 30 "${BASE}${path}" 2>/dev/null)" || true
  [ -f "$TMP/body" ] || : > "$TMP/body"
  if [ "$status" = "$want_status" ] && grep -q -- "$want_text" "$TMP/body"; then
    echo "PASS ${path} (${status})"
  else
    echo "FAIL ${path}: got ${status}, wanted ${want_status} containing '${want_text}'"
    head -c 300 "$TMP/body" || true; echo
    FAILS=$((FAILS + 1))
  fi
}

check /api/health 200 '"status":"ok"'
check /api/ready 200 '"db":"connected"'
check / 200 '<div id="root">'
check /api/auth/me 401 'UNAUTHENTICATED\|"error"'          # access restriction: no session -> 401
check /api/courses 401 '"error"'
if [ -n "$EXPECT_COMMIT" ]; then
  check /api/version 200 "\"commit\":\"${EXPECT_COMMIT}\""   # R-08: the running commit
else
  check /api/version 200 '"commit"'
fi

if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  JAR="$TMP/jar"
  body="$(printf '{"email":"%s","password":"%s"}' "$SMOKE_EMAIL" "$SMOKE_PASSWORD")"
  status="$(curl -sS -o /dev/null -w '%{http_code}' -c "$JAR" -H 'Content-Type: application/json' \
    --data-binary "$body" --max-time 30 "${BASE}/api/auth/login")"
  if [ "$status" = "200" ] && curl -sS -b "$JAR" --max-time 30 "${BASE}/api/auth/me" | grep -q '"user"'; then
    echo "PASS login and authenticated /api/auth/me"
    curl -sS -o /dev/null -b "$JAR" -X POST --max-time 30 "${BASE}/api/auth/logout" && echo "PASS logout"
  else
    echo "FAIL login (status ${status})"; FAILS=$((FAILS + 1))
  fi
elif [ -n "${SMOKE_EMAIL:-}${SMOKE_PASSWORD:-}" ]; then
  echo "FAIL set both SMOKE_EMAIL and SMOKE_PASSWORD, or neither"; FAILS=$((FAILS + 1))
else
  echo "SKIP login (SMOKE_EMAIL / SMOKE_PASSWORD not set)"
fi

[ "$FAILS" -eq 0 ] && echo "Smoke test passed: ${BASE}" || { echo "Smoke test FAILED (${FAILS})"; exit 1; }
