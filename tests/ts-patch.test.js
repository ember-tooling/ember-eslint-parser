import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { patchTs, syncMtsGtsSourceFiles } from '../src/parser/ts-patch.js';

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

// syncMtsGtsSourceFiles walks every file in the program on every type-aware
// parse. Only `getSourceFiles` and `getSourceFile` are used, so a plain object
// stands in for the program.
//
// The twin-to-source links are module state keyed on the source file objects,
// so every test builds its own rather than sharing a fixture.
describe('syncMtsGtsSourceFiles', () => {
  function sourceFile(filePath, extra = {}) {
    return {
      path: filePath,
      fileName: filePath,
      originalFileName: filePath,
      resolvedPath: filePath,
      impliedNodeFormat: undefined,
      version: '1',
      text: `contents of ${filePath}`,
      statements: [],
      ...extra,
    };
  }

  function program(files) {
    return {
      getSourceFiles: () => files,
      getSourceFile: (p) => files.find((f) => f.path === p),
    };
  }

  it('mirrors a .gts onto its .mts twin while keeping the twin identity', () => {
    const gts = sourceFile('/app/comp.gts', { text: 'transformed gts' });
    const mts = sourceFile('/app/comp.mts', { text: 'stale' });

    syncMtsGtsSourceFiles(program([gts, mts]));

    expect(mts.text).toBe('transformed gts');
    expect(mts.statements).toBe(gts.statements);
    expect(mts.path).toBe('/app/comp.mts');
    expect(mts.fileName).toBe('/app/comp.mts');
    expect(mts.isVirtualGts).toBe(true);
  });

  it('falls back to the .ts twin when no .mts is in the program', () => {
    const gts = sourceFile('/app/comp.gts', { text: 'transformed gts' });
    const tsTwin = sourceFile('/app/comp.ts', { text: 'stale' });

    syncMtsGtsSourceFiles(program([gts, tsTwin]));

    expect(tsTwin.text).toBe('transformed gts');
    expect(tsTwin.path).toBe('/app/comp.ts');
  });

  it('mirrors a .gjs onto its .mjs twin', () => {
    const gjs = sourceFile('/app/comp.gjs', { text: 'transformed gjs' });
    const mjs = sourceFile('/app/comp.mjs', { text: 'stale' });

    syncMtsGtsSourceFiles(program([gjs, mjs]));

    expect(mjs.text).toBe('transformed gjs');
    expect(mjs.isVirtualGjs).toBe(true);
  });

  it('falls back to the .js twin when no .mjs is in the program', () => {
    const gjs = sourceFile('/app/comp.gjs', { text: 'transformed gjs' });
    const jsTwin = sourceFile('/app/comp.js', { text: 'stale' });

    syncMtsGtsSourceFiles(program([gjs, jsTwin]));

    expect(jsTwin.text).toBe('transformed gjs');
    expect(jsTwin.path).toBe('/app/comp.js');
  });

  it('picks up a new source file object for the same path', () => {
    const mts = sourceFile('/app/comp.mts', { text: 'stale' });
    syncMtsGtsSourceFiles(program([sourceFile('/app/comp.gts', { text: 'first' }), mts]));
    expect(mts.text).toBe('first');

    const reparsed = sourceFile('/app/comp.gts', { text: 'second', version: '2' });
    syncMtsGtsSourceFiles(program([reparsed, mts]));
    expect(mts.text).toBe('second');
  });

  it('picks up a new version of the same source file object', () => {
    const gts = sourceFile('/app/comp.gts', { text: 'first' });
    const mts = sourceFile('/app/comp.mts', { text: 'stale' });
    syncMtsGtsSourceFiles(program([gts, mts]));

    gts.text = 'second';
    gts.version = '2';
    syncMtsGtsSourceFiles(program([gts, mts]));

    expect(mts.text).toBe('second');
  });

  // Re-copying ~50 properties per .gts on every parse is what made this
  // function scale with project size rather than with the file being linted.
  // `lineMap` stands in for the lazily-derived state TypeScript writes onto a
  // twin between parses: a re-copy overwrites it with the source's value.
  it('does not re-copy a twin that is already current', () => {
    const gts = sourceFile('/app/comp.gts', { text: 'shared', lineMap: undefined });
    const mts = sourceFile('/app/comp.mts', { text: 'stale', lineMap: undefined });
    syncMtsGtsSourceFiles(program([gts, mts]));

    const computedByTypeScript = [0, 7];
    mts.lineMap = computedByTypeScript;
    syncMtsGtsSourceFiles(program([gts, mts]));

    expect(mts.lineMap).toBe(computedByTypeScript);
    expect(mts.text).toBe('shared');
  });

  it('clears the version of a virtual whose original has been deleted', () => {
    const gts = sourceFile('/app/comp.gts');
    const mts = sourceFile('/app/comp.mts');
    syncMtsGtsSourceFiles(program([gts, mts]));
    expect(mts.version).toBe('1');

    syncMtsGtsSourceFiles(program([mts]));

    expect(mts.version).toBeNull();
  });

  it('clears the version of a .mjs virtual whose .gjs original has been deleted', () => {
    const gjs = sourceFile('/app/comp.gjs');
    const mjs = sourceFile('/app/comp.mjs');
    syncMtsGtsSourceFiles(program([gjs, mjs]));

    syncMtsGtsSourceFiles(program([mjs]));

    expect(mjs.version).toBeNull();
  });

  // The virtual flag also lands on the .ts fallback twin, whose path the
  // virtual suffix does not match. It must not be mistaken for an orphan.
  it('keeps a flagged .ts fallback twin alive once its .gts is gone', () => {
    const gts = sourceFile('/app/comp.gts');
    const tsTwin = sourceFile('/app/comp.ts');
    syncMtsGtsSourceFiles(program([gts, tsTwin]));
    expect(tsTwin.isVirtualGts).toBe(true);

    syncMtsGtsSourceFiles(program([tsTwin]));

    expect(tsTwin.version).toBe('1');
  });

  it('leaves files that are neither templates nor virtuals alone', () => {
    const plain = sourceFile('/app/util.ts');
    const declaration = sourceFile('/app/types.d.ts');
    const before = [{ ...plain }, { ...declaration }];

    syncMtsGtsSourceFiles(program([plain, declaration]));

    expect(plain).toEqual(before[0]);
    expect(declaration).toEqual(before[1]);
  });
});
