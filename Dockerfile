# CPMS container image (Lab 5, R-01): one image runs the UI + API, and the same image runs
# database migrations (`migrate`). Used by docker-compose.yml locally, by CI, and by Cloud Run.
# No secret is baked in: every setting comes from the environment at run time (R-02).

# ---- build: install all workspace deps, generate Prisma client, build the React UI ----
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Manifests + Prisma schema first, so `npm ci` is cached until dependencies change.
# (server's postinstall runs `prisma generate`, which needs the schema.)
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
COPY server/prisma server/prisma
RUN npm ci --no-audit --no-fund

COPY client client
RUN npm run build -w client

COPY server server

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Which commit this image was built from (R-08). Public Git SHA, not a secret.
ARG APP_COMMIT=unknown
ENV NODE_ENV=production \
    PORT=8080 \
    CLIENT_DIST_DIR=/app/client/dist \
    APP_COMMIT=${APP_COMMIT}

WORKDIR /app
# node_modules keeps the Prisma CLI (dev dependency) because the `migrate` command needs it.
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/client/dist ./client/dist
RUN chmod +x server/docker-entrypoint.sh

USER node
WORKDIR /app/server
EXPOSE 8080
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["serve"]
