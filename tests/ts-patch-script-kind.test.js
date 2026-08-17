/**
 * Regression tests for the script kind of a virtual twin.
 *
 * `syncMtsGtsSourceFiles` mirrors a `.gts`/`.gjs` source file onto the virtual
 * `.mts`/`.mjs` twin that TypeScript resolved imports to, by copying the source
 * file's own properties over it. A short list of the twin's identity fields is
 * preserved through that copy, and `scriptKind` has to be one of them.
 *
 * If it isn't, the twin ends up carrying the `.gts` file's `ScriptKind.Deferred`
 * while the language service host still reports `ScriptKind.TS` for a `.mts`
 * path. TypeScript's `getOrCreateSourceFileByPath` treats that mismatch as
 * "cannot reuse this document": it releases the document and acquires a fresh
 * one, which is a full re-parse, where a matching kind would have taken the
 * cheap update path. And it never converges — the re-acquired file comes back as
 * TS and the next sync stamps it back to Deferred — so the cost is one re-parse
 * per twin per parse, growing with the number of `.gts`/`.gjs` files in the
 * project.
 *
 * These tests pin the copy's contract directly rather than through a real
 * program: the twin keeps its own identity and script kind, and takes
 * everything else from the file it mirrors.
 */
import { describe, expect, it } from 'vitest';

import { syncMtsGtsSourceFiles } from '../src/parser/ts-patch.js';

/** ts.ScriptKind values used below, spelled out so the intent survives reading. */
const SCRIPT_KIND = { JS: 1, TS: 3, Deferred: 7 };

function fakeSourceFile(path, extra = {}) {
  return {
    path,
    fileName: path,
    originalFileName: path,
    resolvedPath: path,
    version: '1',
    ...extra,
  };
}

function fakeProgram(sourceFiles) {
  const byPath = new Map(sourceFiles.map((file) => [file.path, file]));
  return {
    getSourceFiles: () => sourceFiles,
    getSourceFile: (path) => byPath.get(path),
  };
}

describe('syncMtsGtsSourceFiles', () => {
  it('leaves a .mts twin reporting itself as TypeScript, not Deferred', () => {
    const gts = fakeSourceFile('/app/thing.gts', {
      scriptKind: SCRIPT_KIND.Deferred,
      statements: ['from gts'],
    });
    const twin = fakeSourceFile('/app/thing.mts', {
      scriptKind: SCRIPT_KIND.TS,
      statements: ['stale'],
    });

    syncMtsGtsSourceFiles(fakeProgram([gts, twin]));

    expect(twin.scriptKind).toBe(SCRIPT_KIND.TS);
    // still mirrors the source it stands in for
    expect(twin.statements).toEqual(['from gts']);
    // and keeps its own identity
    expect(twin.fileName).toBe('/app/thing.mts');
    expect(twin.path).toBe('/app/thing.mts');
    expect(twin.isVirtualGts).toBe(true);
  });

  it('leaves a .mjs twin reporting itself as JavaScript', () => {
    const gjs = fakeSourceFile('/app/thing.gjs', {
      scriptKind: SCRIPT_KIND.Deferred,
      statements: ['from gjs'],
    });
    const twin = fakeSourceFile('/app/thing.mjs', {
      scriptKind: SCRIPT_KIND.JS,
      statements: ['stale'],
    });

    syncMtsGtsSourceFiles(fakeProgram([gjs, twin]));

    expect(twin.scriptKind).toBe(SCRIPT_KIND.JS);
    expect(twin.statements).toEqual(['from gjs']);
    expect(twin.isVirtualGjs).toBe(true);
  });

  it('is stable across repeated syncs, so a twin never flips kind', () => {
    const gts = fakeSourceFile('/app/thing.gts', {
      scriptKind: SCRIPT_KIND.Deferred,
      statements: ['from gts'],
    });
    const twin = fakeSourceFile('/app/thing.mts', { scriptKind: SCRIPT_KIND.TS });
    const program = fakeProgram([gts, twin]);

    syncMtsGtsSourceFiles(program);
    syncMtsGtsSourceFiles(program);
    syncMtsGtsSourceFiles(program);

    expect(twin.scriptKind).toBe(SCRIPT_KIND.TS);
  });

  it('falls back to the .ts twin and preserves its kind too', () => {
    const gts = fakeSourceFile('/app/thing.gts', {
      scriptKind: SCRIPT_KIND.Deferred,
      statements: ['from gts'],
    });
    const twin = fakeSourceFile('/app/thing.ts', {
      scriptKind: SCRIPT_KIND.TS,
      statements: ['stale'],
    });

    syncMtsGtsSourceFiles(fakeProgram([gts, twin]));

    expect(twin.scriptKind).toBe(SCRIPT_KIND.TS);
    expect(twin.statements).toEqual(['from gts']);
  });
});
