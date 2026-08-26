#!/usr/bin/env bash
# Build + stage xcollab for the air-gapped k2 cluster.
#
# Runs ON THE MAC. It (1) builds the sovereign api bundle and the Next.js
# standalone web output, (2) stages them next to the k2-stage Dockerfiles,
# (3) rsyncs the stage to k2-registry:/home/admin/xcollab-build/, and
# (4) PRINTS (never executes) the ssh-sudo docker build+push commands and
# the promote.sh call. A human runs the printed commands — this script
# never touches the cluster, the registry, or k2-gitops.
#
# Usage:
#   bin/k2-build.sh [descriptor] [--dry-run]
#
#   descriptor   middle segment of the image tag
#                TAG = v0.1-<descriptor>-<git short sha>   (default: sovereign)
#   --dry-run    rsync -n against a local temp dir stand-in instead of
#                k2-registry — full build + staging, zero network. Use this
#                to validate the script end to end.
#
# Env overrides:
#   K2_REGISTRY_HOST   ssh host for the registry box   (default: k2-registry)
#   K2_BUILD_DIR       remote build dir                (default: /home/admin/xcollab-build)
#   K2_STAGE_DIR       local staging dir               (default: ~/.cache/xcollab-k2-stage)
#   NEXT_PUBLIC_API_URL, NEXT_PUBLIC_KEYCLOAK_ISSUER, NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
#                      BAKED into the web bundle at this build. Defaults
#                      target the proposed dev host; override per env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGISTRY="172.26.34.205:5000"
K2_REGISTRY_HOST="${K2_REGISTRY_HOST:-k2-registry}"
K2_BUILD_DIR="${K2_BUILD_DIR:-/home/admin/xcollab-build}"
STAGE="${K2_STAGE_DIR:-$HOME/.cache/xcollab-k2-stage}"

DESCRIPTOR="sovereign"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -*) echo "unknown flag: $arg" >&2; exit 2 ;;
    *) DESCRIPTOR="$arg" ;;
  esac
done

SHORT_SHA="$(git -C "$ROOT" rev-parse --short HEAD)"
TAG="v0.1-${DESCRIPTOR}-${SHORT_SHA}"

# NEXT_PUBLIC_* are inlined into client bundles NOW, on the Mac. The /api
# prefix rides the same VirtualService host as the web app (see chart).
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-https://xcollab.xedge-internal.corp}"
export NEXT_PUBLIC_KEYCLOAK_ISSUER="${NEXT_PUBLIC_KEYCLOAK_ISSUER:-https://keycloak.xedge-internal.corp/realms/xcollab}"
export NEXT_PUBLIC_KEYCLOAK_CLIENT_ID="${NEXT_PUBLIC_KEYCLOAK_CLIENT_ID:-xcollab-web}"

echo "== xcollab k2 build =="
echo "tag:                 $TAG"
echo "baked NEXT_PUBLIC_API_URL:            $NEXT_PUBLIC_API_URL"
echo "baked NEXT_PUBLIC_KEYCLOAK_ISSUER:    $NEXT_PUBLIC_KEYCLOAK_ISSUER"
echo "baked NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: $NEXT_PUBLIC_KEYCLOAK_CLIENT_ID"

# ---- 1. Build artifacts on the Mac (the only place with npm access) -------
echo "== building sovereign api bundle =="
"$ROOT/bin/build-api.sh" sovereign
"$ROOT/bin/verify-sovereign.sh" "$ROOT/services/api/dist/server-sovereign.mjs"

echo "== building Next.js standalone web output =="
( cd "$ROOT" && NEXT_TELEMETRY_DISABLED=1 pnpm --filter @xcollab/web build )

STANDALONE="$ROOT/apps/web/.next/standalone"
[ -f "$STANDALONE/apps/web/server.js" ] || {
  echo "missing $STANDALONE/apps/web/server.js — Next standalone build incomplete" >&2
  exit 1
}

# ---- 2. Stage: exactly what the k2-stage Dockerfiles expect ----------------
echo "== staging into $STAGE =="
rm -rf "$STAGE"
mkdir -p "$STAGE/api" "$STAGE/web"

cp "$ROOT/deploy/docker/api.Dockerfile" "$STAGE/api/Dockerfile"
cp "$ROOT/services/api/dist/server-sovereign.mjs" "$STAGE/api/server-sovereign.mjs"

cp "$ROOT/deploy/docker/web.Dockerfile" "$STAGE/web/Dockerfile"
# Prune darwin-arm64 native modules (sharp): they cannot dlopen in a
# linux/amd64 pod (ERR_DLOPEN_FAILED) and the app has no next/image usage,
# so sharp is never loaded. Excludes are ANCHORED (leading slash) relative
# to the transfer root — a bare 'node_modules' pattern would also match
# nested node_modules dirs the standalone tree NEEDS.
rsync -a \
  --exclude='/node_modules/.pnpm/@img+sharp-darwin-arm64@*' \
  --exclude='/node_modules/.pnpm/@img+sharp-libvips-darwin-arm64@*' \
  "$STANDALONE/" "$STAGE/web/standalone/"
rsync -a "$ROOT/apps/web/.next/static/" "$STAGE/web/static/"
rsync -a "$ROOT/apps/web/public/" "$STAGE/web/public/"

echo "stage sizes:"
du -sh "$STAGE/api" "$STAGE/web"

# ---- 3. rsync stage -> k2-registry -----------------------------------------
# The stage INTENTIONALLY ships web/standalone/node_modules — never add a
# bare --exclude='node_modules' here; anchor any exclude with a leading '/'.
RSYNC_FLAGS=(-az --delete --exclude='/.DS_Store' --exclude='.DS_Store')
if [ "$DRY_RUN" -eq 1 ]; then
  DEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/xcollab-k2-rsync-standin.XXXXXX")"
  echo "== DRY RUN: rsync -n against local stand-in $DEST_DIR =="
  rsync -n -v "${RSYNC_FLAGS[@]}" "$STAGE/" "$DEST_DIR/" | tail -5
  DEST="$DEST_DIR (local stand-in)"
else
  echo "== rsync to $K2_REGISTRY_HOST:$K2_BUILD_DIR/ =="
  rsync "${RSYNC_FLAGS[@]}" -e "ssh -o BatchMode=yes" \
    "$STAGE/" "$K2_REGISTRY_HOST:$K2_BUILD_DIR/"
  DEST="$K2_REGISTRY_HOST:$K2_BUILD_DIR"
fi
echo "synced -> $DEST"

# ---- 4. Print (do NOT execute) the human-run steps -------------------------
cat <<EOF

== NEXT STEPS (run these yourself — this script will not) ==

# 1. Build + push on k2-registry (sudo required for docker there):
ssh $K2_REGISTRY_HOST "sudo docker build --platform=linux/amd64 \\
  -t $REGISTRY/infra/xcollab-api:$TAG $K2_BUILD_DIR/api \\
  && sudo docker push $REGISTRY/infra/xcollab-api:$TAG"

ssh $K2_REGISTRY_HOST "sudo docker build --platform=linux/amd64 \\
  -t $REGISTRY/infra/xcollab-web:$TAG $K2_BUILD_DIR/web \\
  && sudo docker push $REGISTRY/infra/xcollab-web:$TAG"

# 2. Promote via GitOps (Argo CD is authoritative — never kubectl set image):
cd ~/workspace/k2-gitops
bin/promote.sh xcollab-api dev $TAG
bin/promote.sh xcollab-web dev $TAG

# 3. If tasdiq-dev shows OutOfSync, run the manual Argo CD sync from
#    k2-master (see deploy/README.md, "tasdiq-dev manual sync").

TAG=$TAG
EOF
