/**
 * Regression tests for the JS-fallback parse path.
 *
 * The JS path runs when @typescript-eslint/parser isn't available (or when
 * `useBabel: true` is set). Historically this path produced an AST that
 * ESLint refused — `oxc-parser` only emits `start`/`end` byte offsets, so
 * `Program.loc` and `Program.range` were missing and `Program.tokens` was
 * empty. Lint of any .gjs file blew up with `TypeError: AST is missing
 * location information.`, and rules that walk tokens (e.g. no-dupe-args)
 * crashed even after that.
 *
 * These tests force the JS path via `useBabel: true` and pin the contract
 * at two layers: the AST shape the parser returns, and a real Linter pass
 * driving an ESLint rule that walks tokens. Both fail under oxc.
 *
 * Switch back to oxc once https://github.com/oxc-project/oxc/issues/10307
 * lands native loc support.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';

describe('JS path (useBabel) — AST shape ESLint requires', () => {
  const code = [
    "import currentYear from './helper.js';",
    '',
    '<template>',
    '  <p>{{(currentYear)}}, hi</p>',
    '</template>',
  ].join('\n');

  const result = parseForESLint(code, {
    filePath: 'fixture.gjs',
    useBabel: true,
  });

  it('Program node carries loc, range, tokens, and comments', () => {
    const ast = result.ast;
    expect(ast.type).toBe('Program');
    expect(ast.loc).toBeDefined();
    expect(ast.loc.start).toMatchObject({ line: expect.any(Number), column: expect.any(Number) });
    expect(ast.loc.end).toMatchObject({ line: expect.any(Number), column: expect.any(Number) });
    expect(ast.range).toEqual([expect.any(Number), expect.any(Number)]);
    expect(Array.isArray(ast.tokens)).toBe(true);
    expect(ast.tokens.length).toBeGreaterThan(0);
    expect(Array.isArray(ast.comments)).toBe(true);
  });

  it('inner JS nodes carry loc and range (rules read these everywhere)', () => {
    const importDecl = result.ast.body[0];
    expect(importDecl.type).toBe('ImportDeclaration');
    expect(importDecl.loc).toBeDefined();
    expect(importDecl.range).toEqual([expect.any(Number), expect.any(Number)]);
  });

  it('produces a scope manager that resolves the import', () => {
    expect(result.scopeManager).toBeDefined();
    const moduleScope = result.scopeManager.scopes.find((s) => s.type === 'module');
    expect(moduleScope).toBeDefined();
    expect(moduleScope.set.has('currentYear')).toBe(true);
  });
});

describe('JS path (useBabel) — end-to-end Linter pass', () => {
  function makeLinter() {
    const linter = new Linter();
    linter.defineParser('ember-eslint-parser', {
      parseForESLint: (code, options) => parseForESLint(code, { ...options, useBabel: true }),
    });
    return linter;
  }

  it('lints a .gjs file without throwing on missing loc/tokens', () => {
    const linter = makeLinter();
    const code = [
      "import currentYear from './helper.js';",
      '',
      '<template>',
      '  <p>{{(currentYear)}}, hi</p>',
      '</template>',
    ].join('\n');

    // `no-dupe-args` is a core rule that calls
    // `astUtils.getOpeningParenOfParams(...).loc.start`, which reaches
    // through the token stream. Under the oxc path this throws because
    // `program.tokens` is empty. Enabling the rule keeps that surface
    // covered even if a future change quietly restores `loc` but still
    // ships an empty token array.
    const messages = linter.verify(
      code,
      {
        parser: 'ember-eslint-parser',
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        rules: { 'no-dupe-args': 'error' },
      },
      { filename: 'fixture.gjs' }
    );

    // The fatal "AST is missing location information" / "Cannot read
    // properties of null (reading 'loc')" errors land here as
    // `fatal: true` messages — assert there are none.
    const fatal = messages.filter((m) => m.fatal);
    expect(fatal).toEqual([]);
  });

  it('marks template-only references as used (scope wiring is intact)', () => {
    const linter = makeLinter();
    const code = [
      "import currentYear from './helper.js';",
      '',
      '<template>',
      '  <p>{{(currentYear)}}, hi</p>',
      '</template>',
    ].join('\n');

    const messages = linter.verify(
      code,
      {
        parser: 'ember-eslint-parser',
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        rules: { 'no-unused-vars': 'error' },
      },
      { filename: 'fixture.gjs' }
    );

    const unused = messages.filter((m) => m.ruleId === 'no-unused-vars');
    expect(unused).toEqual([]);
  });
});
