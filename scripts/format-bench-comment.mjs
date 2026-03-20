/**
 * Format benchmark comparison results into a GitHub PR comment.
 *
 * Reads the plain-text mitata output and (optionally) the JSON results from
 * the bench run, then produces a GitHub-flavored markdown comment with:
 *   1. A summary table (when comparison data is available)
 *   2. Full mitata output in a collapsible <details> section
 *
 * Environment variables:
 *   BENCH_OUTPUT_FILE   - Path to the plain-text bench output
 *   BENCH_JSON_OUTPUT   - Path to the JSON bench results (optional)
 *   BENCH_JOB_SUCCESS   - Set to "true" if the benchmark job succeeded
 */

import { readFileSync } from 'node:fs';

const marker = '<!-- bench-compare -->';

// ---------------------------------------------------------------------------
// Read raw mitata output
// ---------------------------------------------------------------------------

let rawOutput;
try {
  rawOutput = readFileSync(process.env.BENCH_OUTPUT_FILE, 'utf8').trim();
} catch {
  console.warn('Warning: could not read BENCH_OUTPUT_FILE; using placeholder text.');
  rawOutput = '(no output — benchmark may have failed to start)';
}

// Strip any lines before the mitata header (safety net for leaked setup messages)
const benchStart = rawOutput.search(/^(clk:|benchmark\b)/m);
if (benchStart > 0) {
  rawOutput = rawOutput.slice(benchStart);
}

// ---------------------------------------------------------------------------
// Read JSON results (if available) and build summary
// ---------------------------------------------------------------------------

let summarySection = '';
const jsonPath = process.env.BENCH_JSON_OUTPUT;

if (jsonPath) {
  try {
    const json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    summarySection = buildSummary(json);
  } catch {
    // JSON not available or malformed — skip summary
  }
}

function formatTime(ns) {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`;
  return `${ns.toFixed(2)} ns`;
}

function deltaEmoji(pct) {
  const abs = Math.abs(pct);
  // negative pct means experiment is faster (lower time = better)
  if (abs < 2) return '⚪';
  if (pct <= -5) return '🟢';
  if (pct >= 5) return '🔴';
  if (pct < 0) return '🟢';
  return '🟠';
}

function buildSummary(json) {
  const benchmarks = json.benchmarks || [];

  // In comparison mode, benchmarks come in pairs inside summary groups.
  // Each benchmark alias is like "gts small (control)" / "gts small (experiment)".
  // Group them by stripping the suffix.
  const pairs = new Map();

  for (const trial of benchmarks) {
    for (const r of trial.runs || []) {
      if (!r.stats) continue;
      const m = r.name.match(/^(.+)\s+\((control|experiment)\)$/);
      if (!m) continue;
      const [, key, role] = m;
      if (!pairs.has(key)) pairs.set(key, {});
      pairs.get(key)[role] = r.stats;
    }
  }

  if (pairs.size === 0) return '';

  const rows = [];
  for (const [name, { control, experiment }] of pairs) {
    if (!control || !experiment) continue;
    const ctrlVal = control.p50 ?? control.avg;
    const expVal = experiment.p50 ?? experiment.avg;
    const delta = ((expVal - ctrlVal) / ctrlVal) * 100;
    const emoji = deltaEmoji(delta);
    const sign = delta > 0 ? '+' : '';
    rows.push(
      `| ${emoji} | ${name} | ${formatTime(ctrlVal)} | ${formatTime(expVal)} | ${sign}${delta.toFixed(1)}% |`
    );
  }

  if (rows.length === 0) return '';

  return [
    '',
    '| | Benchmark | Control (p50) | Experiment (p50) | Δ |',
    '|---|---|---:|---:|---:|',
    ...rows,
    '',
    '> 🟢 faster · 🔴 slower · 🟠 slightly slower · ⚪ within 2%',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Assemble comment
// ---------------------------------------------------------------------------

const success = process.env.BENCH_JOB_SUCCESS === 'true';
const heading = success ? '## 🏎️ Benchmark Comparison' : '## ❌ Benchmark Comparison (failed)';

const body = [
  marker,
  heading,
  summarySection,
  '<details>',
  '<summary>Full mitata output</summary>',
  '',
  '```',
  rawOutput,
  '```',
  '',
  '</details>',
].join('\n');

process.stdout.write(body + '\n');
