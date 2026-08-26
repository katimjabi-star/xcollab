# xcollab-web — k2-registry stage Dockerfile (air-gapped build host).
#
# This file runs NO package manager. It copies the prebuilt Next.js
# standalone output produced on the Mac by `pnpm --filter @xcollab/web build`
# (next.config.ts has output: "standalone" with the monorepo tracing root),
# so it builds on the fully air-gapped k2-registry host. node:20-slim is
# already cached there; docker.io pulls time out.
#
# NEXT_PUBLIC_* values are BAKED at Mac build time (bin/k2-build.sh prints
# what was baked). Changing them requires a rebuild on the Mac, not here.
#
# Expected build context (staged by bin/k2-build.sh):
#   .
#   ├── Dockerfile     (this file)
#   ├── standalone/    (apps/web/.next/standalone — traced server + node_modules;
#   │                   darwin-native @img/sharp* dirs pruned at staging: they
#   │                   cannot dlopen on linux/amd64 and the app uses no
#   │                   next/image, so sharp is never loaded)
#   ├── static/        (apps/web/.next/static — not traced, shipped explicitly)
#   └── public/        (apps/web/public)
#
# Build (on k2-registry, sudo required for docker):
#   sudo docker build --platform=linux/amd64 \
#     -t 172.26.34.205:5000/infra/xcollab-web:<TAG> \
#     /home/admin/xcollab-build/web

FROM node:20-slim

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# uid 10001 matches the chart's PSA-restricted securityContext (runAsUser).
RUN useradd --uid 10001 --user-group --shell /usr/sbin/nologin xcollab

WORKDIR /app
# Monorepo standalone layout: the server entrypoint lives at
# apps/web/server.js under the tracing root. Root-owned on purpose (the
# chart runs readOnlyRootFilesystem; writable dirs are emptyDir mounts:
# /tmp and /app/apps/web/.next/cache).
COPY standalone/ ./
COPY static/ ./apps/web/.next/static
COPY public/ ./apps/web/public

USER 10001
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
