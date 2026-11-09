/**
 * Lints this project with typescript-eslint's experimental tsgo backend
 * (typescript-eslint/typescript-eslint#12803) and checks the exact results.
 *
 * - src/floating-promise.ts is on tsgo. Its only error needs the type of a
 *   function imported from a .gts file, which tsgo gets only through the
 *   tsconfig's contentMappers (ember-content-mapper).
 * - src/component.gts is on the ts6 fallback (see src/parser/ts7/index.js).
 * - src-fixable/ checks that autofix output still parses on both paths.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { ESLint } from 'eslint';

const here = import.meta.dirname;
const require = createRequire(import.meta.url);

function relative(filePath) {
  return path.relative(here, filePath);
}

function describe(results) {
  return results
    .flatMap((r) =>
      r.messages.map((m) => `${relative(r.filePath)}:${m.line}:${m.column} ${m.ruleId ?? m.message}`)
    )
    .sort();
}

// typescript-estree loads classic TypeScript as `typescript` and TS7 as
// `@typescript/native`. Both packages are named `typescript`, so a package
// manager can resolve one to the other.
const parserDir = path.dirname(require.resolve('@typescript-eslint/parser/package.json'));
const estreeRequire = createRequire(
  require.resolve('@typescript-eslint/typescript-estree/package.json', { paths: [parserDir] })
);
const classicVersion = estreeRequire('typescript/package.json').version;
const nativeVersion = estreeRequire('@typescript/native/package.json').version;
assert.match(classicVersion, /^6\./, `typescript-estree resolved typescript@${classicVersion}`);
assert.match(nativeVersion, /^7\./, `typescript-estree resolved @typescript/native@${nativeVersion}`);

const linted = await new ESLint({ cwd: here }).lintFiles(['src']);
assert.deepEqual(describe(linted), [
  'src/component.gts:4:3 @typescript-eslint/no-floating-promises',
  'src/floating-promise.ts:4:3 @typescript-eslint/no-floating-promises',
]);

const relinter = new ESLint({ cwd: here });
for (const result of await new ESLint({ cwd: here, fix: true }).lintFiles(['src-fixable'])) {
  const name = relative(result.filePath);
  assert.ok(result.output, `${name}: expected a fix`);
  assert.match(result.output, /\{\s*return 1;?\s*\}/, `${name}: unexpected fix output:\n${result.output}`);
  const relinted = await relinter.lintText(result.output, { filePath: result.filePath });
  assert.deepEqual(describe(relinted), [], `${name}: fixed output:\n${result.output}`);
}

console.log(`ok: typescript ${classicVersion}, @typescript/native ${nativeVersion}`);
