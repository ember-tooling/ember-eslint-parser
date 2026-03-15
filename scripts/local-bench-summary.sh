#!/usr/bin/env bash

export BENCH_JSON_OUTPUT=./bench-results.json

pnpm bench:compare

echo ""
echo "━━━ Summary ━━━"
node scripts/format-bench-cli.mjs
