#!/bin/sh
# Restore the demo database to its pristine seeded state.
# Usage: sh scripts/demo-reset.sh
cd "$(dirname "$0")/.." || exit 1
if [ ! -f db/demo-baseline.db ]; then
  echo "No baseline found at db/demo-baseline.db" >&2
  exit 1
fi
cp db/demo-baseline.db db/custom.db
echo "Demo database reset to baseline."
