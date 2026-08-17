/**
 * The virtual `.mts`/`.mjs` twin of a `.gts`/`.gjs` file has to keep the script
 * kind its own extension implies. `syncMtsGtsSourceFiles` mirrors the source
 * file onto the twin by copying its properties over, and the source is
 * `ScriptKind.Deferred` — that's how the language service host classifies an
 * unknown extension — so an unguarded copy leaves the twin claiming Deferred
 * while the host still reports TS for its `.mts` path.
 *
 * TypeScript reads that mismatch in `getOrCreateSourceFileByPath` as "cannot
 * reuse this document" and releases the document to acquire a fresh one — a
 * full re-parse — where a matching kind takes the cheap update path. It never
 * settles either: the re-acquired file comes back as TS and the next sync
 * stamps it back to Deferred, so every twin is re-parsed on every parse.
 *
 * These tests drive a real project through the parser and check both halves:
 * the kind the twins report, and whether they survive a rebuild.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseForESLint } from '../src/parser/gjs-gts-parser.js';

const require = createRequire(import.meta.url);
const parserPath = require.resolve('@typescript-eslint/parser');
const ts = require(require.resolve('typescript', { paths: [parserPath] }));

const FILE_COUNT = 3;

let parseOptions;

/** Write a project of `.gts`/`.gjs` files, each with a twin TypeScript resolves to. */
function writeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-parser-script-kind-'));
  const app = path.join(dir, 'app');
  fs.mkdirSync(app);
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowJs: true,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['app/**/*'],
    })
  );
  for (let i = 0; i < FILE_COUNT; i++) {
    fs.writeFileSync(
      path.join(app, `comp${i}.gts`),
      `export const value${i}: number = ${i};\n<template>{{value${i}}}</template>\n`
    );
    fs.writeFileSync(
      path.join(app, `plain${i}.gjs`),
      `export const plain${i} = ${i};\n<template>{{plain${i}}}</template>\n`
    );
  }
  return { dir, app };
}

function parse(filePath, code) {
  return parseForESLint(code ?? fs.readFileSync(filePath, 'utf8'), { ...parseOptions, filePath });
}

function sourceFile(program, name) {
  return program.getSourceFile(path.join(appDir, name));
}

const { dir: projectDir, app: appDir } = writeProject();
const base = {
  tsconfigRootDir: projectDir,
  extraFileExtensions: ['.gts', '.gjs'],
  comment: true,
  loc: true,
  range: true,
  tokens: true,
  sourceType: 'module',
};

// The twins only land in a DocumentRegistry under the project service, which is
// where the release/re-acquire happens. It is spelled differently across
// typescript-eslint majors and may be absent entirely, so feature-detect it —
// at module scope, because `skipIf` is evaluated during collection.
function detectProjectService() {
  for (const options of [{ projectService: true }, { EXPERIMENTAL_useProjectService: true }]) {
    parseOptions = { ...base, ...options };
    try {
      if (parse(path.join(appDir, 'comp0.gts')).services?.program) return true;
    } catch {
      // unsupported spelling — try the next one
    }
  }
  return false;
}

const hasProjectService = detectProjectService();

afterAll(() => {
  if (projectDir) fs.rmSync(projectDir, { recursive: true, force: true });
});

describe('script kind of virtual .mts/.mjs twins', () => {
  it.skipIf(!hasProjectService)(
    "follows the twin's own extension, not the .gts/.gjs Deferred kind",
    () => {
      const program = parse(path.join(appDir, 'comp0.gts')).services.program;

      // the sources are Deferred — that's the kind that must not reach the twins
      expect(sourceFile(program, 'comp1.gts').scriptKind).toBe(ts.ScriptKind.Deferred);
      expect(sourceFile(program, 'comp1.mts').scriptKind).toBe(ts.ScriptKind.TS);
      expect(sourceFile(program, 'plain1.mjs').scriptKind).toBe(ts.ScriptKind.JS);

      // and the twins still mirror the files they stand in for
      expect(sourceFile(program, 'comp1.mts').isVirtualGts).toBe(true);
      expect(sourceFile(program, 'plain1.mjs').isVirtualGjs).toBe(true);
    }
  );

  it.skipIf(!hasProjectService)(
    'lets TypeScript reuse the twins across a rebuild instead of re-parsing them',
    () => {
      // Linting an edited buffer — what an editor does as you type — rebuilds the
      // program. Every file but the edited one should come back as the same
      // SourceFile object; a new object means TypeScript threw the document away
      // and re-parsed it.
      const edited = path.join(appDir, 'comp0.gts');
      const source = fs.readFileSync(edited, 'utf8');
      const untouched = ['comp1.mts', 'comp2.mts', 'plain1.mjs', 'plain2.mjs'];

      let previous = null;
      for (let round = 0; round < 3; round++) {
        const program = parse(edited, `${source}// edit ${round}\n`).services.program;
        const files = untouched.map((name) => sourceFile(program, name));

        expect(files.every(Boolean)).toBe(true);
        for (const [i, file] of files.entries()) {
          if (previous) {
            expect(file, `${untouched[i]} was re-parsed on round ${round}`).toBe(previous[i]);
          }
        }
        previous = files;
      }
    }
  );
});
