/**
 * Format benchmark comparison results into a GitHub PR comment.
 *
 * Reads the plain-text mitata output and (optionally) the JSON results from
 * one or more bench runs, then produces a GitHub-flavored markdown comment
 * with, per bench:
 *   1. A summary table (when comparison data is available)
 *   2. Full mitata output in a collapsible <details> section
 *
 * Sections can be passed as repeated CLI triples:
 *   node scripts/format-bench-comment.mjs \
 *     --section "Parse" bench-output.txt bench-results.json \
 *     --section "Project mode" project-output.txt project-results.json
 *
 * With no --section args, a single unlabelled section is read from the
 * environment (the original interface):
 *   BENCH_OUTPUT_FILE   - Path to the plain-text bench output
 *   BENCH_JSON_OUTPUT   - Path to the JSON bench results (optional)
 *
 * Environment variables:
 *   BENCH_JOB_SUCCESS   - Set to "true" if the benchmark job succeeded
 */

import { readFileSync } from 'node:fs';
import { formatTime, deltaEmoji, parsePairs, readBenchJSON } from './bench-utils.mjs';

const marker = '<!-- bench-compare -->';

// ---------------------------------------------------------------------------
// Collect sections
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const sections = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--section') {
    sections.push({ title: args[i + 1], outputFile: args[i + 2], jsonFile: args[i + 3] });
    i += 3;
  }
}
if (sections.length === 0) {
  sections.push({
    title: null,
    outputFile: process.env.BENCH_OUTPUT_FILE,
    jsonFile: process.env.BENCH_JSON_OUTPUT,
  });
}

// ---------------------------------------------------------------------------
// Render each section
// ---------------------------------------------------------------------------

function renderSection({ title, outputFile, jsonFile }) {
  let rawOutput;
  try {
    rawOutput = readFileSync(outputFile, 'utf8').trim();
  } catch {
    console.warn(`Warning: could not read bench output ${outputFile}; using placeholder text.`);
    rawOutput = '(no output — benchmark may have failed to start)';
  }

  // Strip any lines before the mitata header (safety net for leaked setup messages)
  const benchStart = rawOutput.search(/^(clk:|benchmark\b)/m);
  if (benchStart > 0) {
    rawOutput = rawOutput.slice(benchStart);
  }

  let summarySection = '';
  if (jsonFile) {
    try {
      const rows = parsePairs(readBenchJSON(jsonFile));

      if (rows.length > 0) {
        const tableRows = rows.map(({ name, control, experiment, delta }) => {
          const emoji = deltaEmoji(delta);
          const sign = delta > 0 ? '+' : '';
          return `| ${emoji} | ${name} | ${formatTime(control)} | ${formatTime(experiment)} | ${sign}${delta.toFixed(1)}% |`;
        });

        summarySection = [
          '',
          '| | Benchmark | Control (p50) | Experiment (p50) | Δ |',
          '|---|---|---:|---:|---:|',
          ...tableRows,
          '',
          '> 🟢 faster · 🔴 slower · 🟠 slightly slower · ⚪ within 2%',
          '',
        ].join('\n');
      }
    } catch {
      // JSON not available or malformed — skip summary
    }
  }

  return [
    ...(title ? [`### ${title}`, ''] : []),
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
}

// ---------------------------------------------------------------------------
// Assemble comment
// ---------------------------------------------------------------------------

const success = process.env.BENCH_JOB_SUCCESS === 'true';
const heading = success ? '## 🏎️ Benchmark Comparison' : '## ❌ Benchmark Comparison (failed)';

const body = [marker, heading, ...sections.map(renderSection)].join('\n');

process.stdout.write(body + '\n');
