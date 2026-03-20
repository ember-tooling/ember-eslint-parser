#!/usr/bin/env bash
#
# Wrapper that runs a node command with CPU pinning and high priority
# when available, for lower-variance benchmarks.
#
# Usage: ./scripts/run-bench.sh <node args...>

set -euo pipefail

NODE_ARGS=("--expose-gc" "$@")

CMD=(node "${NODE_ARGS[@]}")

# CPU pinning on Linux — keep the process on a single core
if command -v taskset &>/dev/null; then
  CMD=(taskset -c 0 "${CMD[@]}")
  echo "📌  CPU pinning enabled (taskset -c 0)" >&2
fi

# High scheduling priority (best-effort, negative nice needs root)
if command -v nice &>/dev/null; then
  if [ "$(id -u)" = "0" ]; then
    CMD=(nice -n -20 "${CMD[@]}")
    echo "⚡  High priority enabled (nice -n -20)" >&2
  elif command -v sudo &>/dev/null && sudo -n true 2>/dev/null; then
    CMD=(sudo nice -n -20 "${CMD[@]}")
    echo "⚡  High priority enabled (sudo nice -n -20)" >&2
  else
    echo "💡  High priority unavailable (needs passwordless sudo)" >&2
  fi
fi

echo "" >&2
exec "${CMD[@]}"
