/**
 * Lints the .ts file in a pass of its own, so the program is built before this
 * parser is asked for anything. Unless ts.sys is patched by then, the .gts import
 * in uses-dep.gts resolves to `error` and the no-unsafe-* rules fire on it.
 */
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: fileURLToPath(new URL('.', import.meta.url)) });

async function lint(files) {
  const results = await eslint.lintFiles(files);
  if (results.length !== files.length) {
    throw new Error(`expected ${files.length} file(s) linted, got ${results.length}`);
  }
  return results;
}

const results = [
  ...(await lint(['src/plain.ts'])),
  ...(await lint(['src/dep.gts', 'src/uses-dep.gts'])),
];

const problems = results.flatMap((result) =>
  result.messages.map((m) => `${result.filePath}:${m.line}:${m.column} ${m.message} (${m.ruleId})`)
);

if (problems.length > 0) {
  console.error(`${problems.length} unexpected problem(s):`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`ok — ${results.length} files linted, no problems`);
