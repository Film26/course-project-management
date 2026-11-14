#!/bin/sh
# Container entrypoint (Lab 5).
#   serve   (default) start the API, which also serves the built UI from CLIENT_DIST_DIR
#   migrate apply Prisma migrations, then run the idempotent seed unless SEED_ON_MIGRATE=false
# Anything else is run as a command, e.g. `docker compose run --rm app sh`.
set -e

case "${1:-serve}" in
  serve)
    exec node src/server.js
    ;;
  migrate)
    npx --no-install prisma migrate deploy
    if [ "${SEED_ON_MIGRATE:-true}" = "true" ]; then
      node prisma/seed.js
    else
      echo "SEED_ON_MIGRATE=false: seed skipped"
    fi
    ;;
  *)
    exec "$@"
    ;;
esac
