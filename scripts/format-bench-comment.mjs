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
const heading = success ? '## 🏎️ Benchmark Comparison' : '## ❌ Benchmark Comparison (failed)';

let body;
if (benchData) {
  const { branch, base, iterations, results } = benchData;

  function fmtHz(n) {
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  function fmtDelta(r) {
    if (r.note) return r.note;
    const num = parseFloat(r.delta);
    const emoji = num >= 5 ? '🟢 ' : num <= -5 ? '🔴 ' : Math.abs(num) < 1 ? '⚪ ' : '🟡 ';
    return emoji + r.delta;
  }

  function deltaSymbol(r) {
    if (r.note) return '❓';
    const num = parseFloat(r.delta);
    return num >= 5 ? '🟢' : num <= -5 ? '🔴' : Math.abs(num) < 1 ? '⚪' : '🟡';
  }

  function parseKey(key) {
    // key format: "<type> parser > <size> file"
    const separatorIndex = key.indexOf(' > ');
    if (separatorIndex === -1) {
      return { fileType: key, fileSize: '' };
    }
    const fileType = key
      .slice(0, separatorIndex)
      .replace(/ parser$/, '')
      .trim();
    const fileSize = key
      .slice(separatorIndex + 3)
      .replace(/ file$/, '')
      .trim();
    return { fileType, fileSize };
  }

  // Group results by file type for separate tables
  const byFileType = new Map();
  for (const r of results) {
    const { fileType, fileSize } = parseKey(r.key);
    if (!byFileType.has(fileType)) byFileType.set(fileType, []);
    byFileType.get(fileType).push({ r, fileSize });
  }

  // One 2-column table per file type (shown in main comment): file size | Δ
  const summaryTables = [...byFileType.entries()].flatMap(([fileType, entries]) => [
    `**${fileType}**`,
    '',
    `| File Size | Δ |`,
    `|-----------|---|`,
    ...entries.map(({ r, fileSize }) => `| ${fileSize} | ${deltaSymbol(r)} |`),
    '',
  ]);

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

  const legend =
    '🟢 ≥ +5% faster &nbsp; 🔴 ≤ −5% slower &nbsp; 🟡 within ±5% similar &nbsp; ⚪ within ±1% unchanged';
  const methodology =
    iterations > 1 ? `\n_Trimmed mean of ${iterations} runs per branch (min/max dropped)._` : '';

  // Distribution box plots (only when multi-iteration with per-run data)
  function pct(sorted, p) {
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  }

  function boxPlot(values, gMin, gMax, width) {
    if (values.length < 2) return ' '.repeat(width);
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = pct(sorted, 25);
    const med = pct(sorted, 50);
    const q3 = pct(sorted, 75);
    const mn = sorted[0];
    const mx = sorted[sorted.length - 1];
    const range = gMax - gMin;
    if (range === 0) {
      const m = Math.floor(width / 2);
      return ' '.repeat(m) + '│' + ' '.repeat(width - m - 1);
    }
    const pos = (v) => {
      const p = ((v - gMin) / range) * (width - 1);
      return Math.max(0, Math.min(width - 1, Math.round(p)));
    };
    const mnP = pos(mn);
    const q1P = pos(q1);
    const medP = pos(med);
    const q3P = pos(q3);
    const mxP = pos(mx);
    let r = '';
    for (let i = 0; i < width; i++) {
      if (i === medP) r += '│';
      else if (i === q1P && q1P < q3P) r += '[';
      else if (i === q3P && q1P < q3P) r += ']';
      else if (i > q1P && i < q3P) r += '█';
      else if (i === mnP) r += '├';
      else if (i === mxP) r += '┤';
      else if ((i > mnP && i < q1P) || (i > q3P && i < mxP)) r += '─';
      else r += ' ';
    }
    return r;
  }

  const hasDistribution = iterations > 1 && results.some((r) => r.baseHzValues?.length > 1);
  let distributionSection = [];
  if (hasDistribution) {
    const PW = 40;
    const plotLines = [];
    for (const r of results) {
      if (r.note || !r.baseHzValues?.length || !r.currentHzValues?.length) continue;
      const allVals = [...r.baseHzValues, ...r.currentHzValues];
      const gMin = Math.min(...allVals);
      const gMax = Math.max(...allVals);
      const bp = boxPlot(r.baseHzValues, gMin, gMax, PW);
      const cp = boxPlot(r.currentHzValues, gMin, gMax, PW);
      const bRange = `${fmtHz(Math.min(...r.baseHzValues))} – ${fmtHz(Math.max(...r.baseHzValues))}`;
      const cRange = `${fmtHz(Math.min(...r.currentHzValues))} – ${fmtHz(Math.max(...r.currentHzValues))}`;
      plotLines.push(r.key);
      plotLines.push(`  ${base.padEnd(10)} ${bp}  ${bRange} hz`);
      plotLines.push(`  ${branch.padEnd(10)} ${cp}  ${cRange} hz`);
      plotLines.push('');
    }
    distributionSection = [
      '',
      '<details>',
      '<summary>Distribution across runs (min ├──[Q1 █ median │ █ Q3]──┤ max)</summary>',
      '',
      '```',
      ...plotLines,
      '```',
      '',
      '</details>',
    ];
  }

  body = [
    marker,
    heading,
    '',
    ...summaryTables,
    legend,
    methodology,
    '',
    '<details>',
    `<summary>Full results (${base} vs ${branch})</summary>`,
    '',
    fullHeader,
    fullSep,
    fullRows,
    '',
    '</details>',
    ...distributionSection,
  ].join('\n');
} else {
  body = `${marker}\n${heading}\n\n\`\`\`\n${rawOutput}\n\`\`\``;
}

process.stdout.write(body + '\n');
