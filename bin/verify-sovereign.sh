#!/usr/bin/env bash
# Compile-time exclusion proof for the SOVEREIGN profile (Charter invariant 3):
# the sovereign bundle must contain no hosted-adapter residue. Fails the build
# (docker or local) if any marker string is present.
# Usage: bin/verify-sovereign.sh [path-to-bundle]
set -euo pipefail

BUNDLE="${1:-services/api/dist/server-sovereign.mjs}"
if [ ! -f "$BUNDLE" ]; then
  echo "verify-sovereign: bundle not found: $BUNDLE" >&2
  exit 2
fi

MARKERS=("api.anthropic.com" "openrouter.ai" "x-api-key")
violations=0
for marker in "${MARKERS[@]}"; do
  if grep -qF -- "$marker" "$BUNDLE"; then
    echo "VIOLATION: hosted-adapter marker '$marker' found in $BUNDLE" >&2
    violations=1
  fi
done

if [ "$violations" -ne 0 ]; then
  echo "verify-sovereign: FAIL — $BUNDLE is not a sovereign artifact" >&2
  exit 1
fi
echo "verify-sovereign: PASS — no hosted-adapter markers in $BUNDLE"
