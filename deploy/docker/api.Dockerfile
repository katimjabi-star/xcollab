# xcollab-api — k2-registry stage Dockerfile (air-gapped build host).
#
# This file runs NO package manager. It copies a prebuilt, self-contained
# esbuild bundle produced on the Mac by `bin/build-api.sh sovereign`
# (single-file ESM, node20 target, no native modules), so it builds on the
# fully air-gapped k2-registry host where npm/pnpm cannot reach a registry.
# node:20-slim is already cached on k2-registry; docker.io pulls time out.
#
# Expected build context (staged by bin/k2-build.sh):
#   .
#   ├── Dockerfile            (this file)
#   └── server-sovereign.mjs  (services/api/dist/server-sovereign.mjs)
#
# Build (on k2-registry, sudo required for docker):
#   sudo docker build --platform=linux/amd64 \
#     -t 172.26.34.205:5000/infra/xcollab-api:<TAG> \
#     /home/admin/xcollab-build/api
#
# Runtime env (via ConfigMap/Secret in the chart): DATABASE_URL,
# APP_DATABASE_URL, KEYCLOAK_ISSUER, KEYCLOAK_AUDIENCE (optional),
# KEYCLOAK_SVC_CLIENT_ID, KEYCLOAK_SVC_CLIENT_SECRET, MINIO_ENDPOINT,
# MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_USE_SSL,
# CORS_ALLOWED_ORIGINS, PORT, and optionally OLLAMA_BASE_URL/OLLAMA_MODEL.

FROM node:20-slim

ENV NODE_ENV=production \
    PORT=4000

# uid 10001 matches the chart's PSA-restricted securityContext (runAsUser).
RUN useradd --uid 10001 --user-group --shell /usr/sbin/nologin xcollab

WORKDIR /app
# Root-owned on purpose: the app must not be able to rewrite its own code;
# the chart runs with readOnlyRootFilesystem anyway.
COPY server-sovereign.mjs ./server.mjs

USER 10001
EXPOSE 4000
CMD ["node", "server.mjs"]
