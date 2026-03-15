#!/usr/bin/env bash

# Check CPU governor on Linux — powersave causes massive variance
gov_warning=""
if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
  gov=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)
  if [ "$gov" != "performance" ]; then
    gov_warning="⚠️  CPU governor is '$gov' — benchmark results will be noisy.
   Fix with: sudo cpupower frequency-set -g performance"
    echo ""
    echo "$gov_warning"
    echo ""
  fi
fi

export BENCH_JSON_OUTPUT=./bench-results.json

pnpm bench:compare

echo ""
echo "━━━ Summary ━━━"
node scripts/format-bench-cli.mjs

if [ -n "$gov_warning" ]; then
  echo "$gov_warning"
  echo ""
fi
