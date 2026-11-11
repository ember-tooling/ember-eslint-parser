import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseForESLint } from '../src/parser/gjs-gts-parser.js';

// End-to-end cover for the size heuristic, which only shows itself above 20MB:
// TypeScript's ProjectService weighs every root it does not recognise as
// TypeScript against `maxProgramSizeForNonTsFiles` and disables the project's
// language service past the limit. A disabled project reports only the files
// the client has open as program roots, so with `parserOptions.projectService`
// -- one open file at a time -- the program collapses to that single file plus
// whatever it imports, and every file linted after it rebuilds from scratch.
//
// Two projects, identical but for the extension carrying the bytes: `.gts` is
// TypeScript and must not count, `.gjs` is JavaScript and must.

const MB = 1024 * 1024;
const BULK_FILES = 21;
const AMBIENT = `declare global {
  const AMBIENT_FLAG: string;
}
export {};
`;

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-parser-sizelimit-'));

function makeProject(name, ext) {
  const dir = path.join(root, name);
  const app = path.join(dir, 'app');
  fs.mkdirSync(app, { recursive: true });

  // Padding so each file is ~1MB on disk; only the byte total matters here.
  const filler = `/*${'x'.repeat(MB)}*/\n`;
  const typed = ext === 'gts';
  for (let i = 0; i < BULK_FILES; i++) {
    fs.writeFileSync(
      path.join(app, `bulk${i}.${ext}`),
      `${filler}export default class Bulk${i} {
  get label()${typed ? ': string' : ''} {
    return 'bulk${i}';
  }
  <template>
    <div>{{this.label}}</div>
  </template>
}
`
    );
  }

  fs.writeFileSync(path.join(app, 'ambient.d.ts'), AMBIENT);
  fs.writeFileSync(path.join(app, 'entry.ts'), 'export const entry = 1;\n');
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowJs: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ['app/**/*'],
    })
  );

  return { dir, probe: path.join(app, `bulk0.${ext}`) };
}

// `projectService` is spelled differently across typescript-eslint majors and
// is absent before v7, so probe a throwaway project rather than assuming it.
// The CI matrix runs this suite against @typescript-eslint/parser ^6 upward.
function projectServiceWorks() {
  const dir = path.join(root, 'probe');
  const app = path.join(dir, 'app');
  fs.mkdirSync(app, { recursive: true });
  const probe = path.join(app, 'probe.gts');
  fs.writeFileSync(probe, 'export const probe = 1;\n<template>hi</template>\n');
  fs.writeFileSync(path.join(app, 'sibling.ts'), 'export const sibling = 1;\n');
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify({ compilerOptions: { noEmit: true, skipLibCheck: true }, include: ['app/**/*'] })
  );
  try {
    // The sibling is only a root if the tsconfig was actually loaded. A parser
    // that ignored the unknown option would hand back a single-file program
    // instead, which would fail the real assertions for the wrong reason.
    return parseProbe({ dir, probe }).rootFileNames.some((f) => f.endsWith('sibling.ts'));
  } catch {
    return false;
  }
}

function parseProbe({ dir, probe }) {
  const result = parseForESLint(fs.readFileSync(probe, 'utf8'), {
    filePath: probe,
    projectService: true,
    tsconfigRootDir: dir,
    sourceType: 'module',
    ecmaVersion: 'latest',
    loc: true,
    range: true,
    comment: true,
    tokens: true,
  });
  const program = result.services.program;
  return {
    rootFileNames: program.getRootFileNames(),
    hasAmbient: program.getSourceFiles().some((f) => f.fileName.endsWith('app/ambient.d.ts')),
  };
}

const supported = projectServiceWorks();

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe.skipIf(!supported)('a project over the 20MB non-TypeScript budget', () => {
  let warn;
  let gtsHeavy;
  let gjsHeavy;

  beforeAll(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    gtsHeavy = parseProbe(makeProject('gts-heavy', 'gts'));
    gjsHeavy = parseProbe(makeProject('gjs-heavy', 'gjs'));
  }, 120_000);

  afterAll(() => {
    warn?.mockRestore();
  });

  it('keeps a whole program when the bytes are .gts', () => {
    // Every file the tsconfig matched is a root, not just the one open file.
    // (Root count itself is not exact: patched readDirectory also offers a
    // virtual .mts per .gts, which some `include` globs match and some don't.)
    const gtsRoots = gtsHeavy.rootFileNames.filter((f) => f.endsWith('.gts'));
    expect(gtsRoots.length).toBe(BULK_FILES);
    expect(gtsHeavy.hasAmbient).toBe(true);
  });

  it('still demotes when the bytes are .gjs, which is JavaScript', () => {
    expect(gjsHeavy.rootFileNames.length).toBe(1);
    // The ambient declaration nothing imports is gone from the program, which
    // is why demotion changes type-aware results and not only their speed.
    expect(gjsHeavy.hasAmbient).toBe(false);
  });

  it('says so on stderr instead of silently getting slower', () => {
    const message = warn.mock.calls.map((c) => c[0]).find((m) => /disableSizeLimit/.test(m));
    expect(message).toBeDefined();
    expect(message).toContain('gjs-heavy');
  });
});
