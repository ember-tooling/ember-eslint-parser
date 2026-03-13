#!/usr/bin/env node
/**
 * Benchmark comparison script.
 *
 * Runs `pnpm bench` on the current branch and on `main`, then prints a
 * side-by-side table showing the hz delta for every benchmark.
 *
 * Usage:
 *   node scripts/bench-compare.mjs [--base <branch>]
 *
 * Options:
 *   --base <branch>   Branch to compare against (default: main)
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { styleText } from 'node:util';

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

function currentBranch() {
  return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
}

function hasUncommittedChanges() {
  const result = execSync('git status --porcelain', { encoding: 'utf8' });
  return result.trim().length > 0;
}

function runBench(outputFile) {
  const result = spawnSync(
    'pnpm',
    ['vitest', 'bench', '--outputJson', outputFile, '--run'],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    console.error('\n❌  Benchmark run failed.');
    process.exit(1);
  }
}

function loadResults(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  // Build a map of "Suite > name" → benchmark entry.
  // fullName is e.g. "tests/parser.bench.js > gts parser"; strip the file prefix.
  const map = new Map();
  for (const suite of raw.files ?? []) {
    for (const group of suite.groups ?? []) {
      const suiteName = (group.fullName ?? '').replace(/^.*?>\s*/, '');
      for (const bench of group.benchmarks ?? []) {
        const key = `${suiteName} > ${bench.name}`;
        map.set(key, bench);
      }
    }
  }
  return map;
}

function fmt(n) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function delta(current, base) {
  const pct = ((current - base) / base) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function colorize(pct) {
  const num = Number.parseFloat(pct);
  if (num >= 5) return styleText('green', pct);
  if (num <= -5) return styleText('red', pct);
  return styleText('yellow', pct);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CURRENT_BRANCH = currentBranch();

if (CURRENT_BRANCH === BASE_BRANCH) {
  console.error(`❌  Already on '${BASE_BRANCH}'. Check out your feature branch first.`);
  process.exit(1);
}

const stashed = hasUncommittedChanges();
if (stashed) {
  console.log('📦  Stashing uncommitted changes…');
  run('git stash --include-untracked');
}

const tmpCurrent = join(tmpdir(), 'bench-current.json');
const tmpBase = join(tmpdir(), `bench-${BASE_BRANCH}.json`);

// Clean up temp files on exit
function cleanup() {
  for (const f of [tmpCurrent, tmpBase]) {
    if (existsSync(f)) unlinkSync(f);
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

try {
  // ── 1. Benchmark current branch ──────────────────────────────────────────
  console.log(`\n🔧  Benchmarking current branch: \x1b[36m${CURRENT_BRANCH}\x1b[0m\n`);
  runBench(tmpCurrent);

  // ── 2. Switch to base branch ──────────────────────────────────────────────
  console.log(`\n🔀  Switching to base branch: \x1b[36m${BASE_BRANCH}\x1b[0m\n`);
  run(`git checkout ${BASE_BRANCH}`);
  run('pnpm install --frozen-lockfile');

  // ── 3. Benchmark base branch ──────────────────────────────────────────────
  console.log(`\n🔧  Benchmarking base branch: \x1b[36m${BASE_BRANCH}\x1b[0m\n`);
  runBench(tmpBase);
} finally {
  // ── 4. Restore original branch ────────────────────────────────────────────
  console.log(`\n🔀  Restoring branch: \x1b[36m${CURRENT_BRANCH}\x1b[0m\n`);
  run(`git checkout ${CURRENT_BRANCH}`);
  run('pnpm install --frozen-lockfile');

  if (stashed) {
    console.log('📦  Restoring stash…');
    run('git stash pop');
  }
}

// ── 5. Compare ───────────────────────────────────────────────────────────────

const currentResults = loadResults(tmpCurrent);
const baseResults = loadResults(tmpBase);

const allKeys = new Set([...currentResults.keys(), ...baseResults.keys()]);

const COL = { name: 44, base: 18, current: 18, delta: 12 };
const line = (name, base, cur, diff) =>
  name.padEnd(COL.name) +
  base.padStart(COL.base) +
  cur.padStart(COL.current) +
  diff.padStart(COL.delta);

const ruler = '─'.repeat(COL.name + COL.base + COL.current + COL.delta);

console.log(`\n${'─'.repeat(ruler.length)}`);
console.log(
  `  Benchmark comparison: ${styleText('cyan', CURRENT_BRANCH)} vs ${styleText('cyan', BASE_BRANCH)}`,
);
console.log(`${'─'.repeat(ruler.length)}`);
console.log(
  styleText('bold', line('Benchmark', `${BASE_BRANCH} (hz)`, `${CURRENT_BRANCH} (hz)`, 'Δ')),
);
console.log(ruler);

let lastSuite = '';
for (const key of [...allKeys].sort()) {
  const [suite] = key.split(' > ');
  if (suite !== lastSuite) {
    if (lastSuite) console.log('');
    lastSuite = suite;
  }

  const b = baseResults.get(key);
  const c = currentResults.get(key);

  if (!b || !c) {
    const note = !b ? '(missing in base)' : '(missing in current)';
    console.log(line(`  ${key}`, '-', '-', note));
    continue;
  }

  const pct = delta(c.hz, b.hz);
  console.log(line(`  ${key}`, fmt(b.hz), fmt(c.hz), colorize(pct)));
}

console.log(ruler);
console.log(
  '\n  ' +
    styleText('green', '■') +
    ' ≥ +5%  faster   ' +
    styleText('red', '■') +
    ' ≤ −5%  slower   ' +
    styleText('yellow', '■') +
    ' within ±5%  similar\n',
);
