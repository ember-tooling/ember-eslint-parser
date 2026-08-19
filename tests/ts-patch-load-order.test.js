import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// typescript-eslint copies ts.sys by value when it builds a program, on the
// first type-aware parse in the process — possibly a plain .ts file that never
// reaches this parser. So importing the parser, with no parseForESLint call, has
// to be enough to leave ts.sys patched.
import '../src/parser/gjs-gts-parser.js';

const require = createRequire(import.meta.url);
const parserPath = require.resolve('@typescript-eslint/parser');
const ts = require(require.resolve('typescript', { paths: [parserPath] }));

describe('ts.sys is patched by importing the parser', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ee-parser-load-order-'));
  const gts = path.join(dir, 'component.gts');
  fs.writeFileSync(gts, 'export const name = "x";\n<template>{{name}}</template>\n');

  it('reports the virtual .mts twin of a .gts as existing', () => {
    expect(ts.sys.fileExists(path.join(dir, 'component.mts'))).toBe(true);
  });

  it('reads the .gts through its virtual twin, transformed', () => {
    const content = ts.sys.readFile(path.join(dir, 'component.mts'));

    expect(content).toContain('export const name');
    expect(content).not.toContain('<template>');
  });

  it('offers the virtual twin when TypeScript scans the directory', () => {
    const found = ts.sys.readDirectory(dir, ['.ts', '.gts']);

    expect(found).toContain(path.join(dir, 'component.mts'));
  });
});
