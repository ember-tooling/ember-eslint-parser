/**
 * Benchmark script using mitata.
 *
 * When run standalone (`node --expose-gc tests/parser.bench.mjs`), it benchmarks
 * the local parsers only. When `bench-compare.mjs` passes `--control-dir <dir>`,
 * it also loads the control (base-branch) parsers from that directory and wraps
 * each size in a `summary()` so mitata shows a side-by-side comparison with
 * boxplots.
 *
 * Usage:
 *   node --expose-gc tests/parser.bench.mjs [--control-dir <path>]
 */

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { run, bench, boxplot, summary, B, measure, flags } from 'mitata';

// ---------------------------------------------------------------------------
// Increase mitata's per-benchmark timing for more stable results.
//
// mitata defaults to ~642 ms min CPU time and 12 min samples per benchmark.
// We increase these to collect more samples and reduce variance from
// transient system noise. The values are configurable via env vars.
// ---------------------------------------------------------------------------

const BENCH_MIN_CPU_TIME = Number(process.env.BENCH_MIN_CPU_TIME) || 2_000_000_000;
const BENCH_MIN_SAMPLES = Number(process.env.BENCH_MIN_SAMPLES) || 30;

const _origRun = B.prototype.run;
B.prototype.run = async function (thrw = false) {
  // Only patch static benchmarks (no parametric args) — our use case
  if (Object.keys(this._args).length > 0) return _origRun.call(this, thrw);

  const heap = await (async () => {
    try {
      const { getHeapStatistics } = await import('node:v8');
      getHeapStatistics();
      return () => {
        const m = getHeapStatistics();
        return m.used_heap_size + m.malloced_memory;
      };
    } catch {
      /* not available */
    }
  })();

  const tune = {
    inner_gc: this._gc === 'inner',
    gc: !this._gc ? false : undefined,
    heap,
    min_cpu_time: BENCH_MIN_CPU_TIME,
    min_samples: BENCH_MIN_SAMPLES,
  };

  let stats, error;
  try {
    stats = await measure(this.f, tune);
  } catch (err) {
    error = err;
    if (thrw) throw err;
  }

  return {
    kind: 'static',
    args: this._args,
    alias: this._name,
    group: this._group,
    baseline: !!(this.flags & flags.baseline),
    runs: [{ stats, error, args: {}, name: this._name }],
    style: { highlight: this._highlight, compact: !!(this.flags & flags.compact) },
  };
};

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const ctrlIdx = args.indexOf('--control-dir');
const CONTROL_DIR = ctrlIdx !== -1 ? resolve(args[ctrlIdx + 1]) : null;

// ---------------------------------------------------------------------------
// Load experiment (current branch) parsers
// ---------------------------------------------------------------------------

const require_ = createRequire(import.meta.url);
const experimentGJS = require_('../src/parser/gjs-gts-parser.js');
const experimentHBS = require_('../src/parser/hbs-parser.js');

// ---------------------------------------------------------------------------
// (Optionally) load control (base branch) parsers from tmp dir
// ---------------------------------------------------------------------------

let controlGJS = null;
let controlHBS = null;

if (CONTROL_DIR) {
  const controlRequire = createRequire(resolve(CONTROL_DIR, 'index.js'));
  controlGJS = controlRequire('./src/parser/gjs-gts-parser.js');
  controlHBS = controlRequire('./src/parser/hbs-parser.js');
}

// ---------------------------------------------------------------------------
// Fixture content
// ---------------------------------------------------------------------------

function fixture(name) {
  return readFileSync(fileURLToPath(new URL(`./bench/${name}`, import.meta.url)), 'utf8');
}

const FIXTURES = {
  gts: { small: fixture('small.gts'), medium: fixture('medium.gts'), large: fixture('large.gts') },
  gjs: { small: fixture('small.gjs'), medium: fixture('medium.gjs'), large: fixture('large.gjs') },
  hbs: { small: fixture('small.hbs'), medium: fixture('medium.hbs'), large: fixture('large.hbs') },
};

const PARSE_OPTIONS = { comment: true, loc: true, range: true, tokens: true };

// ---------------------------------------------------------------------------
// Register benchmarks
// ---------------------------------------------------------------------------

const PARSERS = [
  {
    type: 'gts',
    ext: '.gts',
    experimentParse: experimentGJS.parseForESLint,
    controlParse: controlGJS?.parseForESLint,
  },
  {
    type: 'gjs',
    ext: '.gjs',
    experimentParse: experimentGJS.parseForESLint,
    controlParse: controlGJS?.parseForESLint,
  },
  {
    type: 'hbs',
    ext: '.hbs',
    experimentParse: experimentHBS.parseForESLint,
    controlParse: controlHBS?.parseForESLint,
  },
];

const SIZES = ['small', 'medium', 'large'];

for (const { type, ext, experimentParse, controlParse } of PARSERS) {
  for (const size of SIZES) {
    const code = FIXTURES[type][size];
    const opts = { ...PARSE_OPTIONS, filePath: `${size}${ext}` };

    // Force a full GC before each benchmark group to reduce GC-triggered variance
    globalThis.gc?.();

    if (controlParse) {
      // Side-by-side comparison with boxplots
      boxplot(() => {
        summary(() => {
          bench(`${type} ${size} (control)`, () => controlParse(code, opts));
          bench(`${type} ${size} (experiment)`, () => experimentParse(code, opts));
        });
      });
    } else {
      // Standalone mode — just benchmark the local parsers
      bench(`${type} ${size}`, () => experimentParse(code, opts));
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const result = await run({ colors: false, throw: true });

// Write JSON output if requested
const jsonPath = process.env.BENCH_JSON_OUTPUT;
if (jsonPath) {
  const { writeFileSync } = await import('node:fs');

  const benchmarks = result.benchmarks.map((trial) => ({
    alias: trial.alias,
    runs: trial.runs.map((r) => ({
      name: r.name,
      args: r.args,
      error: r.error ? { message: r.error.message || String(r.error) } : undefined,
      stats: r.stats
        ? {
            avg: r.stats.avg,
            min: r.stats.min,
            max: r.stats.max,
            p50: r.stats.p50,
            p75: r.stats.p75,
            p99: r.stats.p99,
            samples: r.stats.samples,
          }
        : undefined,
    })),
  }));

  writeFileSync(jsonPath, JSON.stringify({ context: result.context, benchmarks }, null, 2));
}
