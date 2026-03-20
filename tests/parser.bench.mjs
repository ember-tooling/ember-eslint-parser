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
import { run, bench, boxplot, summary, do_not_optimize as doNotOptimize } from 'mitata';

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

// ---------------------------------------------------------------------------
// JIT warm-up — parse every fixture with both parsers so V8 compiles and
// optimises the hot paths before any measurement begins.  Without this, the
// first-to-run parser pays the JIT compilation cost, creating order bias.
// ---------------------------------------------------------------------------

const WARMUP_ROUNDS = 5;

for (const { type, ext, experimentParse, controlParse } of PARSERS) {
  for (const size of SIZES) {
    const code = FIXTURES[type][size];
    const opts = { ...PARSE_OPTIONS, filePath: `${size}${ext}` };

    for (let i = 0; i < WARMUP_ROUNDS; i++) {
      experimentParse(code, opts);
      controlParse?.(code, opts);
    }
  }
}

globalThis.gc?.();

// More iterations per sample → individual GC spikes get diluted, reducing
// variance on noisy CI runners.  Scale down for larger fixtures so each
// sample doesn't take too long (mitata needs many samples for stable stats).
const BENCH_ITERS = { small: 1000, medium: 500, large: 100 };

for (const { type, ext, experimentParse, controlParse } of PARSERS) {
  for (const size of SIZES) {
    const code = FIXTURES[type][size];
    const opts = { ...PARSE_OPTIONS, filePath: `${size}${ext}` };
    const iters = BENCH_ITERS[size];

    // Force a full GC before each benchmark group to reduce GC-triggered variance
    globalThis.gc?.();

    if (controlParse) {
      // Side-by-side comparison with boxplots
      boxplot(() => {
        summary(() => {
          bench(`${type} ${size} (control)`, () => {
            for (let i = 0; i < iters; i++) doNotOptimize(controlParse(code, opts));
          });
          bench(`${type} ${size} (experiment)`, () => {
            for (let i = 0; i < iters; i++) doNotOptimize(experimentParse(code, opts));
          });
        });
      });
    } else {
      // Standalone mode — just benchmark the local parsers
      bench(`${type} ${size}`, () => {
        for (let i = 0; i < iters; i++) doNotOptimize(experimentParse(code, opts));
      });
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
