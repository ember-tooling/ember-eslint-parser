/**
 * Format benchmark JSON results as a CLI-friendly summary table.
 *
 * Environment variables:
 *   BENCH_JSON_OUTPUT - Path to the JSON bench results
 */

import { readFileSync } from 'node:fs';

const jsonPath = process.env.BENCH_JSON_OUTPUT;

if (!jsonPath) {
  console.error('BENCH_JSON_OUTPUT not set');
  process.exit(1);
}

let json;

try {
  json = JSON.parse(readFileSync(jsonPath, 'utf8'));
} catch (e) {
  console.error(`Could not read ${jsonPath}: ${e.message}`);
  process.exit(1);
}

function formatTime(ns) {
  if (ns >= 1e6) return `${(ns / 1e6).toFixed(2)} ms`;
  if (ns >= 1e3) return `${(ns / 1e3).toFixed(2)} µs`;

  return `${ns.toFixed(2)} ns`;
}

function deltaEmoji(pct) {
  const abs = Math.abs(pct);

  if (abs < 1) return '⚪';
  if (pct <= -5) return '🟢';
  if (pct >= 5) return '🔴';

  return '🟡';
}

// Group control/experiment pairs
const pairs = new Map();

for (const trial of json.benchmarks || []) {
  for (const r of trial.runs || []) {
    if (!r.stats) continue;

    const m = r.name.match(/^(.+)\s+\((control|experiment)\)$/);

    if (!m) continue;

    const [, key, role] = m;

    if (!pairs.has(key)) pairs.set(key, {});

    pairs.get(key)[role] = r.stats;
  }
}

if (pairs.size === 0) {
  console.log('No comparison data found.');
  process.exit(0);
}

// Build rows
const rows = [];

for (const [name, { control, experiment }] of pairs) {
  if (!control || !experiment) continue;

  const delta = ((experiment.avg - control.avg) / control.avg) * 100;

  rows.push({ name, control: control.avg, experiment: experiment.avg, delta });
}

if (rows.length === 0) {
  console.log('No comparison data found.');
  process.exit(0);
}

// Calculate column widths
const nameW = Math.max('Benchmark'.length, ...rows.map((r) => r.name.length));
const ctrlW = Math.max('Control (avg)'.length, ...rows.map((r) => formatTime(r.control).length));
const expW = Math.max(
  'Experiment (avg)'.length,
  ...rows.map((r) => formatTime(r.experiment).length)
);
const deltaW = Math.max(
  'Δ'.length,
  ...rows.map((r) => {
    const sign = r.delta > 0 ? '+' : '';

    return `${sign}${r.delta.toFixed(1)}%`.length;
  })
);

// Print table
const pad = (s, w, right) => (right ? s.padStart(w) : s.padEnd(w));

console.log();
console.log(
  `   ${pad('Benchmark', nameW)}   ${pad('Control (avg)', ctrlW, true)}   ${pad('Experiment (avg)', expW, true)}   ${pad('Δ', deltaW, true)}`
);
console.log(
  `   ${'─'.repeat(nameW)}   ${'─'.repeat(ctrlW)}   ${'─'.repeat(expW)}   ${'─'.repeat(deltaW)}`
);

for (const row of rows) {
  const emoji = deltaEmoji(row.delta);
  const sign = row.delta > 0 ? '+' : '';
  const deltaStr = `${sign}${row.delta.toFixed(1)}%`;

  console.log(
    `${emoji} ${pad(row.name, nameW)}   ${pad(formatTime(row.control), ctrlW, true)}   ${pad(formatTime(row.experiment), expW, true)}   ${pad(deltaStr, deltaW, true)}`
  );
}

console.log();
console.log('🟢 faster · 🔴 slower · 🟡 within 5% · ⚪ within 1%');
console.log();
