#!/usr/bin/env bash

# Check CPU tuning on Linux — poor settings cause massive variance
hw_warnings=""
hw_fixes=()

if [ -f /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor ]; then
  gov=$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor)
  if [ "$gov" != "performance" ]; then
    hw_warnings+="⚠️  CPU governor is '$gov' — benchmark results will be noisy.
"
    hw_fixes+=("sudo cpupower frequency-set -g performance")
  fi
fi

if [ -f /sys/devices/system/cpu/cpufreq/boost ]; then
  boost=$(cat /sys/devices/system/cpu/cpufreq/boost)
  if [ "$boost" = "1" ]; then
    hw_warnings+="⚠️  CPU boost is enabled — frequency varies with thermals.
"
    hw_fixes+=("echo 0 | sudo tee /sys/devices/system/cpu/cpufreq/boost")
  fi
elif [ -f /sys/devices/system/cpu/intel_pstate/no_turbo ]; then
  no_turbo=$(cat /sys/devices/system/cpu/intel_pstate/no_turbo)
  if [ "$no_turbo" = "0" ]; then
    hw_warnings+="⚠️  Intel Turbo Boost is enabled — frequency varies with thermals.
"
    hw_fixes+=("echo 1 | sudo tee /sys/devices/system/cpu/intel_pstate/no_turbo")
  fi
fi

if [ -n "$hw_warnings" ]; then
  echo ""
  echo "$hw_warnings"

  if [ ${#hw_fixes[@]} -gt 0 ] && [ -t 0 ]; then
    echo "Fix with:"
    for fix in "${hw_fixes[@]}"; do
      echo "  $fix"
    done
    echo ""
    read -rp "Apply these fixes now? [y/N] " answer
    if [[ "$answer" =~ ^[Yy]$ ]]; then
      for fix in "${hw_fixes[@]}"; do
        echo "→ $fix"
        eval "$fix"
      done
      echo ""
      echo "✅  CPU tuning applied."
      echo ""
    fi
  fi
fi

export BENCH_JSON_OUTPUT=./bench-results.json

pnpm bench:compare

echo ""
echo "━━━ Summary ━━━"
node scripts/format-bench-cli.mjs

if [ -n "$hw_warnings" ]; then
  echo "$hw_warnings"
fi
