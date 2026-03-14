/* eslint-disable n/no-process-exit */
/**
 * Benchmark comparison script.
 *
 * Runs `pnpm bench` on the current branch and on `main`, then prints a
 * side-by-side table showing the hz delta for every benchmark.
 *
 * Usage:
 *   node scripts/bench-compare.mjs [--base <branch>] [--iterations <n>]
 *
 * Options:
 *   --base <branch>       Branch to compare against (default: main)
 *   --iterations <n>      Number of benchmark runs per branch; the trimmed
 *                          mean hz is used for comparison (default: 1)
 */

import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { styleText } from 'node:util';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const baseIdx = args.indexOf('--base');
const BASE_BRANCH = baseIdx !== -1 ? args[baseIdx + 1] : 'main';

const iterIdx = args.indexOf('--iterations');
const ITERATIONS = iterIdx !== -1 ? Math.max(1, parseInt(args[iterIdx + 1], 10) || 1) : 1;

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

const IS_LINUX = process.platform === 'linux';
const HAS_TASKSET = IS_LINUX && spawnSync('which', ['taskset'], { stdio: 'pipe' }).status === 0;

if (HAS_TASKSET) {
  console.log('📌  CPU pinning enabled (taskset -c 0) for reduced context-switch variance.');
}

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
  const benchArgs = ['vitest', 'bench', '--outputJson', outputFile, '--run'];

  // Pin to a single CPU core on Linux to eliminate cross-core migration variance.
  const cmd = HAS_TASKSET ? 'taskset' : 'pnpm';
  const args = HAS_TASKSET ? ['-c', '0', 'pnpm', ...benchArgs] : benchArgs;

  // Expose GC so the bench file can trigger manual collections between suites.
  const existingNodeOpts = process.env.NODE_OPTIONS || '';
  const nodeOptions = existingNodeOpts ? `${existingNodeOpts} --expose-gc` : '--expose-gc';

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });
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
        map.set(key, { hz: bench.hz, hzValues: [bench.hz] });
      }
    }
  }
  return map;
}

function runBenchMultiple(outputPrefix, iterations) {
  const files = [];
  for (let i = 0; i < iterations; i++) {
    const outFile = `${outputPrefix}-${i}.json`;
    if (iterations > 1) console.log(`  Run ${i + 1}/${iterations}…`);
    runBench(outFile);
    files.push(outFile);
  }
  return files;
}

function trimmedMean(values) {
  if (values.length <= 2) return values.reduce((a, b) => a + b, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

function percentile(sorted, p) {
  const idx = (p / 100) * (sorted.length - 1);
  const low = Math.floor(idx);
  const high = Math.ceil(idx);
  if (low === high) return sorted[low];
  return sorted[low] + (idx - low) * (sorted[high] - sorted[low]);
}

function asciiBoxPlot(values, globalMin, globalMax, width) {
  if (values.length < 2) return ' '.repeat(width);

  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 25);
  const med = percentile(sorted, 50);
  const q3 = percentile(sorted, 75);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const range = globalMax - globalMin;
  if (range === 0) {
    const mid = Math.floor(width / 2);
    return ' '.repeat(mid) + '│' + ' '.repeat(width - mid - 1);
  }

  const pos = (v) => {
    const p = ((v - globalMin) / range) * (width - 1);
    return Math.max(0, Math.min(width - 1, Math.round(p)));
  };

  const minP = pos(min);
  const q1P = pos(q1);
  const medP = pos(med);
  const q3P = pos(q3);
  const maxP = pos(max);

  let result = '';
  for (let i = 0; i < width; i++) {
    if (i === medP) result += '│';
    else if (i === q1P && q1P < q3P) result += '[';
    else if (i === q3P && q1P < q3P) result += ']';
    else if (i > q1P && i < q3P) result += '█';
    else if (i === minP) result += '├';
    else if (i === maxP) result += '┤';
    else if ((i > minP && i < q1P) || (i > q3P && i < maxP)) result += '─';
    else result += ' ';
  }

  return result;
}

function loadAggregatedResults(files) {
  const allRuns = files.map((f) => loadResults(f));

  const allKeys = new Set();
  for (const run of allRuns) {
    for (const key of run.keys()) allKeys.add(key);
  }

  const map = new Map();
  for (const key of allKeys) {
    const hzValues = allRuns
      .map((run) => run.get(key))
      .filter(Boolean)
      .map((b) => b.hz)
      .sort((a, b) => a - b);

    if (hzValues.length === 0) continue;

    map.set(key, { hz: trimmedMean(hzValues), hzValues });
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
  if (Math.abs(num) < 1) return styleText('white', pct);
  return styleText('yellow', pct);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CURRENT_BRANCH = currentBranch();

if (ITERATIONS > 1) {
  console.log(
    `ℹ️  Running ${ITERATIONS} iterations per branch; trimmed mean (drop min/max) for stable results.`
  );
}

if (CURRENT_BRANCH === BASE_BRANCH) {
  console.error(`❌  Already on '${BASE_BRANCH}'. Check out your feature branch first.`);
  process.exit(1);
}

const stashed = hasUncommittedChanges();
if (stashed) {
  console.log('📦  Stashing uncommitted changes…');
  run('git stash --include-untracked');
}

const tmpCurrentPrefix = join(tmpdir(), 'bench-current');
const tmpBasePrefix = join(tmpdir(), `bench-${BASE_BRANCH}`);

// Clean up temp files on exit
function cleanup() {
  for (let i = 0; i < ITERATIONS; i++) {
    for (const prefix of [tmpCurrentPrefix, tmpBasePrefix]) {
      const f = `${prefix}-${i}.json`;
      if (existsSync(f)) unlinkSync(f);
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

let currentFiles = [];
let baseFiles = [];

try {
  // ── 1. Benchmark current branch ──────────────────────────────────────────
  console.log(`\n🔧  Benchmarking current branch: \x1b[36m${CURRENT_BRANCH}\x1b[0m\n`);
  currentFiles = runBenchMultiple(tmpCurrentPrefix, ITERATIONS);

  // ── 2. Save bench files so both branches use identical config ────────────
  const benchBackupDir = join(tmpdir(), 'bench-compare-backup');
  mkdirSync(benchBackupDir, { recursive: true });
  cpSync('tests/parser.bench.js', join(benchBackupDir, 'parser.bench.js'), { force: true });
  if (existsSync('tests/bench')) {
    cpSync('tests/bench', join(benchBackupDir, 'bench'), { recursive: true, force: true });
  }

  // ── 3. Switch to base branch ──────────────────────────────────────────────
  console.log(`\n🔀  Switching to base branch: \x1b[36m${BASE_BRANCH}\x1b[0m\n`);
  run(`git checkout ${BASE_BRANCH}`);
  run('pnpm install --frozen-lockfile');

  // Overlay the current branch's bench files so both runs use the same config
  console.log('📋  Using bench config from current branch for fair comparison…');
  cpSync(join(benchBackupDir, 'parser.bench.js'), 'tests/parser.bench.js', { force: true });
  if (existsSync(join(benchBackupDir, 'bench'))) {
    cpSync(join(benchBackupDir, 'bench'), 'tests/bench', { recursive: true, force: true });
  }

  // ── 4. Benchmark base branch ──────────────────────────────────────────────
  console.log(`\n🔧  Benchmarking base branch: \x1b[36m${BASE_BRANCH}\x1b[0m\n`);
  baseFiles = runBenchMultiple(tmpBasePrefix, ITERATIONS);
} finally {
  // ── 5. Restore original branch ────────────────────────────────────────────
  // Discard the overlaid bench files before switching back
  run('git checkout -- tests/parser.bench.js');
  if (existsSync('tests/bench')) run('git checkout -- tests/bench/');
  console.log(`\n🔀  Restoring branch: \x1b[36m${CURRENT_BRANCH}\x1b[0m\n`);
  run(`git checkout ${CURRENT_BRANCH}`);
  run('pnpm install --frozen-lockfile');

  if (stashed) {
    console.log('📦  Restoring stash…');
    run('git stash pop');
  }
}

// ── 6. Compare ───────────────────────────────────────────────────────────────

const currentResults =
  ITERATIONS > 1 ? loadAggregatedResults(currentFiles) : loadResults(currentFiles[0]);
const baseResults = ITERATIONS > 1 ? loadAggregatedResults(baseFiles) : loadResults(baseFiles[0]);

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
  `  Benchmark comparison: ${styleText('cyan', CURRENT_BRANCH)} vs ${styleText('cyan', BASE_BRANCH)}`
);
console.log(`${'─'.repeat(ruler.length)}`);
console.log(
  styleText('bold', line('Benchmark', `${BASE_BRANCH} (hz)`, `${CURRENT_BRANCH} (hz)`, 'Δ'))
);
console.log(ruler);

const benchResults = [];

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
    benchResults.push({
      key,
      baseHz: null,
      currentHz: null,
      delta: null,
      note,
      baseHzValues: b?.hzValues ?? [],
      currentHzValues: c?.hzValues ?? [],
    });
    continue;
  }

  const pct = delta(c.hz, b.hz);
  console.log(line(`  ${key}`, fmt(b.hz), fmt(c.hz), colorize(pct)));
  benchResults.push({
    key,
    baseHz: b.hz,
    currentHz: c.hz,
    delta: pct,
    note: null,
    baseHzValues: b.hzValues,
    currentHzValues: c.hzValues,
  });
}

console.log(ruler);
console.log(
  '\n  ' +
    styleText('green', '■') +
    ' ≥ +5%  faster   ' +
    styleText('red', '■') +
    ' ≤ −5%  slower   ' +
    styleText('yellow', '■') +
    ' within ±5%  similar   ' +
    styleText('white', '■') +
    ' within ±1%  unchanged\n'
);

// ── 7. Box plots (when multiple iterations) ──────────────────────────────────

if (ITERATIONS > 1) {
  const PLOT_WIDTH = 40;
  console.log(styleText('bold', '  Distribution across runs (hz)'));
  console.log('  Legend: min ├──[ Q1 ██ median │ ██ Q3 ]──┤ max');
  console.log('');

  let prevSuite = '';
  for (const r of benchResults) {
    if (r.note || !r.baseHzValues.length || !r.currentHzValues.length) continue;

    const [suite] = r.key.split(' > ');
    if (suite !== prevSuite) {
      if (prevSuite) console.log('');
      prevSuite = suite;
    }

    const allVals = [...r.baseHzValues, ...r.currentHzValues];
    const gMin = Math.min(...allVals);
    const gMax = Math.max(...allVals);

    const basePlot = asciiBoxPlot(r.baseHzValues, gMin, gMax, PLOT_WIDTH);
    const curPlot = asciiBoxPlot(r.currentHzValues, gMin, gMax, PLOT_WIDTH);

    const bMin = fmt(Math.min(...r.baseHzValues));
    const bMax = fmt(Math.max(...r.baseHzValues));
    const cMin = fmt(Math.min(...r.currentHzValues));
    const cMax = fmt(Math.max(...r.currentHzValues));

    console.log(`  ${r.key}`);
    console.log(`    ${'base:'.padEnd(10)} ${basePlot}  ${bMin} – ${bMax}`);
    console.log(`    ${'current:'.padEnd(10)} ${curPlot}  ${cMin} – ${cMax}`);
  }

  console.log('');
}

const jsonOutputPath = process.env.BENCH_JSON_OUTPUT;
if (jsonOutputPath) {
  writeFileSync(
    jsonOutputPath,
    JSON.stringify(
      {
        branch: CURRENT_BRANCH,
        base: BASE_BRANCH,
        iterations: ITERATIONS,
        results: benchResults,
      },
      null,
      2
    )
  );
}
