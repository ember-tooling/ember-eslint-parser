import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { patchTs, replaceExtensions } from '../src/parser/ts-patch.js';

// Resolve the same typescript instance ts-patch patches (the one
// @typescript-eslint/parser depends on), so we observe the patched ts.sys.
const require = createRequire(import.meta.url);
const parserPath = require.resolve('@typescript-eslint/parser');
const ts = require(require.resolve('typescript', { paths: [parserPath] }));

// Incremental build state is optional input: when `tsBuildInfoFile` points at
// a file that has not been produced yet (fresh checkout, cleaned repo), the
// watch program used for type-aware linting reads it WITHOUT a fileExists
// probe (readBuilderProgram -> host.readFile). ts.sys.readFile's contract is
// to report a missing file as absent, not to throw — a throw here aborts
// linting of every file in the project with
// `Parsing error: ENOENT ... <project>/declarations/.tsbuildinfo`.
describe('patched ts.sys.readFile — .tsbuildinfo handling', () => {
  patchTs();

  it('treats a missing custom-named .tsbuildinfo as absent instead of throwing', () => {
    // e.g. { "tsBuildInfoFile": "declarations/.tsbuildinfo" } — only the
    // default `tsconfig.tsbuildinfo` name was guarded before.
    const missing = path.join(os.tmpdir(), 'ee-parser-no-such-dir', 'declarations', '.tsbuildinfo');

    expect(() => ts.sys.readFile(missing)).not.toThrow();
    expect(ts.sys.readFile(missing)).toBeUndefined();
  });

  it('returns the real content when the .tsbuildinfo exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-parser-buildinfo-'));
    const buildInfo = path.join(dir, 'custom.tsbuildinfo');
    fs.writeFileSync(buildInfo, '{"version":"5.9.3"}');

    try {
      expect(ts.sys.readFile(buildInfo)).toBe('{"version":"5.9.3"}');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// replaceExtensions skips the TypeScript parse when the text contains no
// `.gts` at all. Everything it rewrites has to keep working, and nothing that
// lacks the substring may be rewritten — a miss here is a silent regression,
// not a visible failure.
describe('replaceExtensions', () => {
  it.each([
    ['default import', `import Foo from './foo.gts';`, `import Foo from './foo.mts';`],
    ['double quotes', `import Foo from "./foo.gts";`, `import Foo from "./foo.mts";`],
    ['named import', `import { a } from './foo.gts';`, `import { a } from './foo.mts';`],
    [
      'type-only import',
      `import type { A } from './foo.gts';`,
      `import type { A } from './foo.mts';`,
    ],
    ['side-effect import', `import './foo.gts';`, `import './foo.mts';`],
    ['re-export', `export { a } from './foo.gts';`, `export { a } from './foo.mts';`],
    ['export star', `export * from './foo.gts';`, `export * from './foo.mts';`],
    ['dynamic import', `const p = import('./foo.gts');`, `const p = import('./foo.mts');`],
    [
      'import attributes',
      `import Foo from './foo.gts' with { type: 'x' };`,
      `import Foo from './foo.mts' with { type: 'x' };`,
    ],
  ])('rewrites a .gts specifier in a %s', (_name, input, expected) => {
    expect(replaceExtensions(input)).toBe(expected);
  });

  it.each([
    ['no module specifiers at all', `export const a = 1;\nexport type B = { c: string };\n`],
    ['only extensionless specifiers', `import Foo from './foo';\nexport * from './bar';\n`],
    ['a .ts specifier', `import Foo from './foo.ts';`],
    ['an uppercase .GTS specifier', `import Foo from './foo.GTS';`],
    ['.gts only inside a comment', `// see ./foo.gts\nimport Foo from './foo';`],
    ['.gts only in a non-specifier string', `const path = './foo.gts';`],
    ['a require() call', `const Foo = require('./foo.gts');`],
    ['a template-literal specifier', 'const p = import(`./foo.gts`);'],
  ])('leaves code with %s unchanged', (_name, input) => {
    expect(replaceExtensions(input)).toBe(input);
  });

  it('rewrites every .gts specifier in a file that mixes them with other imports', () => {
    const input = [
      `import Foo from './foo.gts';`,
      `import Bar from './bar';`,
      `import Baz from './baz.ts';`,
      `export { qux } from './qux.gts';`,
      `const lazy = () => import('./lazy.gts');`,
    ].join('\n');

    expect(replaceExtensions(input)).toBe(
      [
        `import Foo from './foo.mts';`,
        `import Bar from './bar';`,
        `import Baz from './baz.ts';`,
        `export { qux } from './qux.mts';`,
        `const lazy = () => import('./lazy.mts');`,
      ].join('\n')
    );
  });
});
