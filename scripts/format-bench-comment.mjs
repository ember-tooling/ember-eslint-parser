/**
 * Format benchmark comparison results into a GitHub PR comment.
 *
 * Reads the plain-text mitata output from bench-compare.mjs and wraps it in a
 * GitHub-flavored markdown comment.
 *
 * Environment variables:
 *   BENCH_OUTPUT_FILE   - Path to the plain-text bench output
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

const success = process.env.BENCH_JOB_SUCCESS === 'true';
const heading = success ? '## 🏎️ Benchmark Comparison' : '## ❌ Benchmark Comparison (failed)';

const body = [
  marker,
  heading,
  '',
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
