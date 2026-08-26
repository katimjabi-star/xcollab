#!/usr/bin/env bash
# Bundle services/api for a build profile (Charter invariant 3).
# Usage: bin/build-api.sh [sovereign|connected]   (default: sovereign)
# Output: services/api/dist/server-<profile>.mjs — single-file, plain JS,
# node20 target, so no arm64/amd64 native-module leakage into images.
set -euo pipefail

PROFILE="${1:-sovereign}"
case "$PROFILE" in
  sovereign|connected) ;;
  *) echo "unknown profile: $PROFILE (want sovereign|connected)" >&2; exit 2 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="$ROOT/services/api/src/entry-$PROFILE.ts"
OUT="$ROOT/services/api/dist/server-$PROFILE.mjs"

# pg-native is pg's OPTIONAL native binding, loaded lazily and never used by
# us; external keeps esbuild from failing on the absent optional dep.
"$ROOT/node_modules/.bin/esbuild" "$ENTRY" \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --external:pg-native \
  --banner:js="import { createRequire as __xcollabCreateRequire } from 'node:module'; const require = __xcollabCreateRequire(import.meta.url);" \
  --outfile="$OUT" \
  --log-level=warning

echo "built $OUT ($PROFILE)"
