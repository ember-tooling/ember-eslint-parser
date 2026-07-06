/* eslint-disable n/no-process-exit */
/**
 * Project-mode (type-aware) benchmark using mitata.
 *
 * The parse-only benchmarks in parser.bench.mjs never invoke patchTs /
 * syncMtsGtsSourceFiles — those only run with `project` / `projectService`
 * parser options. This bench measures the type-aware path: it generates a
 * synthetic project (N gts components importing each other extensionless,
 * plus supporting .ts modules), builds the TS program once during warm-up,
 * then benchmarks warm per-file parses and typed-rule-style checker queries.
 *
 * When run standalone (`node --expose-gc tests/project.bench.mjs`), it
 * benchmarks the local parser only. When `bench-compare.mjs` passes
 * `--control-dir <dir>`, it also loads the control (base-branch) parser from
 * that directory for a side-by-side comparison.
 *
 * Environment variables:
 *   BENCH_PROJECT_FILES - number of gts components to generate (default 200)
 *   BENCH_JSON_OUTPUT   - path to write JSON results
 *
 * Usage:
 *   node --expose-gc tests/project.bench.mjs [--control-dir <path>]
 */

import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { run, bench, boxplot, summary, do_not_optimize as doNotOptimize } from 'mitata';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const ctrlIdx = args.indexOf('--control-dir');
const CONTROL_DIR = ctrlIdx !== -1 ? resolve(args[ctrlIdx + 1]) : null;

// ---------------------------------------------------------------------------
// Load parsers
// ---------------------------------------------------------------------------

const require_ = createRequire(import.meta.url);
const experiment = require_('../src/parser/gjs-gts-parser.js');
const control = CONTROL_DIR
  ? createRequire(resolve(CONTROL_DIR, 'index.js'))('./src/parser/gjs-gts-parser.js')
  : null;

// ---------------------------------------------------------------------------
// Generate a synthetic project
// ---------------------------------------------------------------------------

const N = parseInt(process.env.BENCH_PROJECT_FILES ?? '200', 10);
const PROJECT_DIR = join(tmpdir(), `eep-project-bench-${process.pid}`);
const APP_DIR = join(PROJECT_DIR, 'app');

function generateProject() {
  rmSync(PROJECT_DIR, { recursive: true, force: true });
  mkdirSync(APP_DIR, { recursive: true });

  writeFileSync(
    join(PROJECT_DIR, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['app/**/*'],
      },
      null,
      2
    )
  );

  for (let i = 0; i < N; i++) {
    const next = (i + 1) % N;
    writeFileSync(
      join(APP_DIR, `comp${i}.gts`),
      `import Component from './base${i}';
import { helper${i} } from './util${i}';
${i % 2 === 0 ? `import Other from './comp${next}';` : ''}

export interface Sig${i} { Args: { count: number; label?: string } }

export default class Comp${i} extends Component<Sig${i}> {
  #internal = ${i};
  get doubled(): number {
    return helper${i}(this.args.count) * 2 + this.#internal;
  }
  get label(): string {
    return this.args.label ?? 'comp${i}';
  }
  <template>
    <div class="comp${i}">
      {{this.label}}: {{this.doubled}}
      {{! template comment with \`backticks\` and $dollars }}
      ${i % 2 === 0 ? '<Other @count={{this.doubled}} />' : ''}
      <span data-x="{{this.args.count}}">static text</span>
    </div>
  </template>
}
`
    );
    writeFileSync(
      join(APP_DIR, `util${i}.ts`),
      `import type Comp from './comp${i}';
export function helper${i}(n: number): number { return n + ${i}; }
export type C${i} = typeof Comp;
`
    );
    writeFileSync(
      join(APP_DIR, `base${i}.ts`),
      `export default class Base${i}<S = unknown> { declare args: S extends { Args: infer A } ? A : never; }\n`
    );
  }
}

function cleanup() {
  if (existsSync(PROJECT_DIR)) {
    try {
      rmSync(PROJECT_DIR, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
}
process.on('exit', cleanup);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

generateProject();

const GTS_FILES = Array.from({ length: N }, (_, i) => join(APP_DIR, `comp${i}.gts`));
const SOURCES = new Map(GTS_FILES.map((f) => [f, readFileSync(f, 'utf8')]));

// ---------------------------------------------------------------------------
// Parse options per mode
// ---------------------------------------------------------------------------

const BASE_OPTIONS = {
  tsconfigRootDir: PROJECT_DIR,
  extraFileExtensions: ['.gts', '.gjs'],
  comment: true,
  loc: true,
  range: true,
  tokens: true,
  sourceType: 'module',
};

const MODES = [{ key: 'project', options: { project: './tsconfig.json' } }];

// projectService is spelled differently across typescript-eslint majors and
// may be absent entirely; feature-detect instead of hardcoding.
function detectProjectService(parse) {
  for (const options of [{ projectService: true }, { EXPERIMENTAL_useProjectService: true }]) {
    try {
      const filePath = GTS_FILES[0];
      const result = parse(SOURCES.get(filePath), { ...BASE_OPTIONS, ...options, filePath });
      if (result.services?.program) return options;
    } catch {
      // unsupported spelling — try the next one
    }
  }
  return null;
}

const serviceOptions = detectProjectService(experiment.parseForESLint);
const controlServiceOptions = control ? detectProjectService(control.parseForESLint) : null;
if (serviceOptions && (!control || controlServiceOptions)) {
  MODES.push({
    key: 'projectService',
    options: serviceOptions,
    controlOptions: controlServiceOptions,
  });
} else {
  console.error(
    'ℹ️  projectService not supported by installed @typescript-eslint/parser — skipping'
  );
}

// ---------------------------------------------------------------------------
// Typed-rule-style checker queries (getTypeAtLocation on every Identifier)
// ---------------------------------------------------------------------------

function walkIdentifiers(node, cb, seen = new Set()) {
  if (!node || typeof node.type !== 'string' || seen.has(node)) return;
  seen.add(node);
  if (node.type === 'Identifier') cb(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) walkIdentifiers(child, cb, seen);
    } else if (value && typeof value === 'object') {
      walkIdentifiers(value, cb, seen);
    }
  }
}

function parseFile(parse, options, filePath) {
  return parse(SOURCES.get(filePath), { ...BASE_OPTIONS, ...options, filePath });
}

function typedQueries(parse, options, filePath) {
  const result = parseFile(parse, options, filePath);
  const program = result.services.program;
  const checker = program.getTypeChecker();
  const esMap = result.services.esTreeNodeToTSNodeMap;
  let count = 0;
  walkIdentifiers(result.ast, (node) => {
    const tsNode = esMap.get(node);
    if (tsNode) {
      doNotOptimize(checker.getTypeAtLocation(tsNode));
      count++;
    }
  });
  return count;
}

// ---------------------------------------------------------------------------
// Warm-up: build every (parser × mode) program and populate checker caches so
// the benchmarks measure warm per-file cost, not program construction.
// ---------------------------------------------------------------------------

console.error(`⏳  Warming up (${N} components, ${MODES.map((m) => m.key).join(', ')})…`);
for (const mode of [...MODES]) {
  try {
    for (const filePath of GTS_FILES) {
      parseFile(experiment.parseForESLint, mode.options, filePath);
      control?.parseForESLint &&
        parseFile(control.parseForESLint, mode.controlOptions ?? mode.options, filePath);
    }
    typedQueries(experiment.parseForESLint, mode.options, GTS_FILES[0]);
    if (control) {
      typedQueries(control.parseForESLint, mode.controlOptions ?? mode.options, GTS_FILES[0]);
    }
  } catch (e) {
    // e.g. typescript-eslint v7's experimental projectService caps how many
    // out-of-project files it accepts, and .gts never becomes in-project
    // there. Drop the mode rather than fail the whole bench.
    MODES.splice(MODES.indexOf(mode), 1);
    console.error(`ℹ️  dropping ${mode.key} mode: ${e.message.split('\n')[0]}`);
  }
}
if (MODES.length === 0) {
  console.error('❌  no usable project modes — cannot benchmark');
  process.exit(1);
}
console.error('✅  Warm-up done\n');

globalThis.gc?.();

// ---------------------------------------------------------------------------
// Register benchmarks
// ---------------------------------------------------------------------------

// Enough work per iteration to stay well above the system-noise floor
// (aim for hundreds of ms, not tens): short iterations let scheduler jitter
// and individual GC pauses dominate the measurement.
const PARSES_PER_ITER = 150;
const TYPED_PER_ITER = 150;

function makeRoundRobin(step) {
  let cursor = 0;
  return () => {
    const files = [];
    for (let i = 0; i < step; i++) {
      files.push(GTS_FILES[cursor]);
      cursor = (cursor + 1) % GTS_FILES.length;
    }
    return files;
  };
}

for (const mode of MODES) {
  const scenarios = [
    {
      name: `${mode.key} warm parse x${PARSES_PER_ITER}`,
      makeFn: (parse, options) => {
        const nextFiles = makeRoundRobin(PARSES_PER_ITER);
        return () => {
          for (const filePath of nextFiles()) doNotOptimize(parseFile(parse, options, filePath));
        };
      },
    },
    {
      name: `${mode.key} parse+typed x${TYPED_PER_ITER}`,
      makeFn: (parse, options) => {
        const nextFiles = makeRoundRobin(TYPED_PER_ITER);
        return () => {
          for (const filePath of nextFiles()) doNotOptimize(typedQueries(parse, options, filePath));
        };
      },
    },
  ];

  for (const scenario of scenarios) {
    globalThis.gc?.();
    // gc('inner') collects before every iteration: each parse batch churns
    // hundreds of MB of AST, and without it major-GC pauses land on random
    // samples — an A/A comparison (identical parsers) read as ±9% otherwise.
    if (control) {
      boxplot(() => {
        summary(() => {
          bench(
            `${scenario.name} (control)`,
            scenario.makeFn(control.parseForESLint, mode.controlOptions ?? mode.options)
          ).gc('inner');
          bench(
            `${scenario.name} (experiment)`,
            scenario.makeFn(experiment.parseForESLint, mode.options)
          ).gc('inner');
        });
      });
    } else {
      bench(scenario.name, scenario.makeFn(experiment.parseForESLint, mode.options)).gc('inner');
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const result = await run({ colors: false, throw: true });

const jsonPath = process.env.BENCH_JSON_OUTPUT;
if (jsonPath) {
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
