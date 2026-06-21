/**
 * Unit tests for how the JS parse path resolves `@babel/eslint-parser`.
 *
 * The parser is loaded once at module init. Two entry points matter:
 *   - `@babel/eslint-parser/experimental-worker` — only exists in v7. It runs
 *     babel in a worker and is what ember-cli wires up for plain `.js` files.
 *   - `@babel/eslint-parser` (main) — v8 dropped the worker subpath, so the
 *     loader must fall back to the main entry, which exposes the same
 *     synchronous `parseForESLint`.
 *
 * `resolveBabelParser` takes an injectable `require` so we can pin the
 * worker → main → null order without installing two majors side by side.
 */

import { describe, expect, it, vi } from 'vitest';
import { resolveBabelParser } from '../src/parser/gjs-gts-parser.js';

const WORKER = '@babel/eslint-parser/experimental-worker';
const MAIN = '@babel/eslint-parser';

function notExported(specifier) {
  const err = new Error(`Package subpath './experimental-worker' is not defined by "exports"`);
  err.code = 'ERR_PACKAGE_PATH_NOT_EXPORTED';
  err.specifier = specifier;
  return err;
}

function notFound(specifier) {
  const err = new Error(`Cannot find module '${specifier}'`);
  err.code = 'MODULE_NOT_FOUND';
  return err;
}

describe('resolveBabelParser — entry resolution order', () => {
  it('uses the experimental-worker entry when it resolves (v7)', () => {
    const worker = { parseForESLint: () => ({}), __entry: 'worker' };
    const req = vi.fn((specifier) => {
      if (specifier === WORKER) return worker;
      throw notFound(specifier);
    });

    expect(resolveBabelParser(req)).toBe(worker);
    expect(req).toHaveBeenCalledTimes(1);
    expect(req).toHaveBeenCalledWith(WORKER);
  });

  it('falls back to the main entry when the worker subpath is missing (v8)', () => {
    const main = { parseForESLint: () => ({}), __entry: 'main' };
    const req = vi.fn((specifier) => {
      if (specifier === WORKER) throw notExported(specifier);
      if (specifier === MAIN) return main;
      throw notFound(specifier);
    });

    expect(resolveBabelParser(req)).toBe(main);
    expect(req).toHaveBeenNthCalledWith(1, WORKER);
    expect(req).toHaveBeenNthCalledWith(2, MAIN);
  });

  it('returns null when neither entry is installed (optional peer absent)', () => {
    const req = vi.fn((specifier) => {
      throw notFound(specifier);
    });

    expect(resolveBabelParser(req)).toBe(null);
    expect(req).toHaveBeenCalledWith(WORKER);
    expect(req).toHaveBeenCalledWith(MAIN);
  });
});
