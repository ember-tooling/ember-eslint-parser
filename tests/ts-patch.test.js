import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { patchTs } from '../src/parser/ts-patch.js';

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
