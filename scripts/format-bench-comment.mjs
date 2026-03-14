/**
 * Format benchmark comparison results into a GitHub PR comment.
 *
 * Reads bench output and JSON results from the paths specified by environment
 * variables and writes the formatted comment body to stdout.
 *
 * Environment variables:
 *   BENCH_OUTPUT_FILE   - Path to the plain-text bench output (optional)
 *   BENCH_JSON_OUTPUT   - Path to the JSON results file written by bench-compare.mjs
 *   BENCH_JOB_SUCCESS   - Set to "true" if the benchmark job succeeded
 */

import { readFileSync } from 'node:fs';

const marker = '<!-- bench-compare -->';

let rawOutput;
try {
  rawOutput = readFileSync(process.env.BENCH_OUTPUT_FILE, 'utf8').trim();
} catch {
  console.warn('Warning: could not read BENCH_OUTPUT_FILE; using placeholder text.');
  rawOutput = '(no output — benchmark may have failed to start)';
}

let benchData = null;
try {
  benchData = JSON.parse(readFileSync(process.env.BENCH_JSON_OUTPUT, 'utf8'));
} catch {
  console.warn('Warning: could not read BENCH_JSON_OUTPUT; falling back to raw output.');
}

const success = process.env.BENCH_JOB_SUCCESS === 'true';
const heading = success
  ? '## 🏎️ Benchmark Comparison'
  : '## ❌ Benchmark Comparison (failed)';

let body;
if (benchData) {
  const { branch, base, results } = benchData;

  function fmtHz(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function fmtDelta(r) {
    if (r.note) return r.note;
    const num = parseFloat(r.delta);
    const emoji = num >= 5 ? '🟢 ' : num <= -5 ? '🔴 ' : '🟡 ';
    return emoji + r.delta;
  }

  // Delta-only table (shown in main comment)
  const deltaHeader = `| Benchmark | Δ |`;
  const deltaSep = `|-----------|---|`;
  const deltaRows = results.map((r) => `| ${r.key} | ${fmtDelta(r)} |`).join('\n');

  // Full table (hidden in <details>)
  const fullHeader = `| Benchmark | ${base} (hz) | ${branch} (hz) | Δ |`;
  const fullSep = `|-----------|-------------|----------------|---|`;
  const fullRows = results
    .map((r) => {
      const b = r.baseHz !== null ? fmtHz(r.baseHz) : '-';
      const c = r.currentHz !== null ? fmtHz(r.currentHz) : '-';
      return `| ${r.key} | ${b} | ${c} | ${fmtDelta(r)} |`;
    })
    .join('\n');

  const legend = '🟢 ≥ +5% faster &nbsp; 🔴 ≤ −5% slower &nbsp; 🟡 within ±5% similar';

  body = [
    marker,
    heading,
    '',
    deltaHeader,
    deltaSep,
    deltaRows,
    '',
    legend,
    '',
    '<details>',
    `<summary>Full results (${base} vs ${branch})</summary>`,
    '',
    fullHeader,
    fullSep,
    fullRows,
    '',
    '</details>',
  ].join('\n');
} else {
  body = `${marker}\n${heading}\n\n\`\`\`\n${rawOutput}\n\`\`\``;
}

process.stdout.write(body + '\n');
