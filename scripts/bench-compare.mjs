/* eslint-disable n/no-process-exit */
/**
 * Benchmark comparison script using mitata.
 *
 * Copies the base branch's source to a temp directory, installs its
 * dependencies, then runs the mitata bench script with --control-dir so that
 * both control (base) and experiment (current) parsers are benchmarked in the
 * same process — giving mitata a fair, head-to-head comparison with built-in
 * summary tables and boxplots.
 *
 * Usage:
 *   node scripts/bench-compare.mjs [--base <branch>]
 *
 * Options:
 *   --base <branch>   Branch to compare against (default: main)
 */

import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE_BRANCH = baseIdx !== -1 ? args[baseIdx + 1] : 'main';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', ...opts });
}

/**
 * Resolve a branch name to a commit SHA. Tries `origin/<branch>` first (for CI
 * where only the PR branch is checked out locally), then falls back to `<branch>`.
 */
function resolveRef(branch) {
  for (const candidate of [`origin/${branch}`, branch]) {
    try {
      return execSync(`git rev-parse --verify ${candidate}`, { encoding: 'utf8' }).trim();
    } catch {
      // try next
    }
  }
  throw new Error(`Could not resolve ref for branch "${branch}". Is it fetched?`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const ROOT = process.cwd();
const CONTROL_DIR = join(tmpdir(), `bench-control-${BASE_BRANCH}-${Date.now()}`);

console.log(`\n🔧  Setting up control (${BASE_BRANCH}) in ${CONTROL_DIR}\n`);

const BASE_REF = resolveRef(BASE_BRANCH);
console.log(`   Resolved ${BASE_BRANCH} → ${BASE_REF.slice(0, 10)}\n`);

// Clean up temp dir on exit
function cleanup() {
  if (existsSync(CONTROL_DIR)) {
    try {
      rmSync(CONTROL_DIR, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

try {
  // ── 1. Export base branch source to temp dir ─────────────────────────────
  mkdirSync(CONTROL_DIR, { recursive: true });

  // Copy package manifests and source (use resolved SHA for reliability)
  run(
    `git archive ${BASE_REF} -- package.json pnpm-lock.yaml pnpm-workspace.yaml src/ | tar -x -C "${CONTROL_DIR}"`
  );

  // ── 2. Install dependencies in control dir ───────────────────────────────
  console.log(`\n📦  Installing dependencies for control (${BASE_BRANCH})…\n`);
  run('pnpm install --frozen-lockfile', { cwd: CONTROL_DIR });

  // ── 3. Run mitata bench with --control-dir ───────────────────────────────
  console.log(`\n🏎️  Running benchmarks (experiment vs control)…\n`);

  const benchScript = join(ROOT, 'tests/parser.bench.mjs');
  const benchArgs = ['--expose-gc', benchScript, '--control-dir', CONTROL_DIR];

  // CPU pinning on Linux
  const IS_LINUX = process.platform === 'linux';
  const HAS_TASKSET = IS_LINUX && spawnSync('which', ['taskset'], { stdio: 'pipe' }).status === 0;

  const cmd = HAS_TASKSET ? 'taskset' : 'node';
  const fullArgs = HAS_TASKSET ? ['-c', '0', 'node', ...benchArgs] : benchArgs;

  if (HAS_TASKSET) {
    console.log('📌  CPU pinning enabled (taskset -c 0)\n');
  }

  const result = spawnSync(cmd, fullArgs, {
    stdio: 'inherit',
    cwd: ROOT,
    env: { ...process.env },
  });

  if (result.status !== 0) {
    console.error('\n❌  Benchmark run failed.');
    process.exit(1);
  }

  console.log('\n✅  Benchmark comparison complete.\n');
} catch (e) {
  console.error('❌  Error:', e.message);
  process.exit(1);
}
