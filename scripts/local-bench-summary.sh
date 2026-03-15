#!/usr/bin/env bash

# Check CPU tuning on Linux — poor settings cause massive variance
hw_warnings=""

if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
  gov=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)
  if [ "$gov" != "performance" ]; then
    hw_warnings+="⚠️  CPU governor is '$gov' — benchmark results will be noisy.
   Fix with: sudo cpupower frequency-set -g performance
"
  fi
fi

if [ -f /sys/devices/system/cpu/cpufreq/boost ]; then
  boost=$(cat /sys/devices/system/cpu/cpufreq/boost)
  if [ "$boost" = "1" ]; then
    hw_warnings+="⚠️  CPU boost is enabled — frequency varies with thermals.
   Fix with: echo 0 | sudo tee /sys/devices/system/cpu/cpufreq/boost
"
  fi
fi

if [ -n "$hw_warnings" ]; then
  echo ""
  echo "$hw_warnings"
fi

export BENCH_JSON_OUTPUT=./bench-results.json

pnpm bench:compare

echo ""
echo "━━━ Summary ━━━"
node scripts/format-bench-cli.mjs

if [ -n "$hw_warnings" ]; then
  echo "$hw_warnings"
fi
