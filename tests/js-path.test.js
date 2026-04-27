/**
 * Regression tests for the JS-fallback parse path.
 *
 * The JS path runs when @typescript-eslint/parser isn't available (or when
 * `useBabel: true` is set). It now defers to @babel/eslint-parser, which
 * picks up the consuming app's babel config — so any plugin enabled there
 * (decorators, etc.) is honoured when linting `.gjs` files.
 *
 * Two earlier shapes of this path each broke ESLint differently:
 *   - oxc-parser emitted only `start`/`end` byte offsets, so `Program.loc`
 *     and `Program.range` were missing and `Program.tokens` was empty.
 *     Lint of any .gjs file blew up with `TypeError: AST is missing
 *     location information.`, and rules that walk tokens (e.g.
 *     no-dupe-args) crashed even after that.
 *   - raw espree carries loc/tokens but rejects modern syntax outright —
 *     `@tracked count = 0;` produced `SyntaxError: Unexpected character '@'`
 *     for every JS-only ember app.
 *
 * These tests force the JS path via `useBabel: true` and pin three
 * contracts: the AST shape ESLint requires, decorator syntax parses
 * cleanly, and a real Linter pass walks tokens without throwing.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';
import { traverse } from '../src/parser/transforms.js';

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

describe('JS path (useBabel) — class decorators', () => {
  // Regression: when @typescript-eslint/parser isn't installed, the JS path
  // historically fell back to raw espree, which rejects `@decorator` syntax
  // outright (`SyntaxError: Unexpected character '@'`). Routing the JS path
  // through @babel/eslint-parser picks up the consuming app's babel config —
  // the decorators plugin lives there for ember apps — so a `.gjs` file with
  // a `@tracked` field parses cleanly without any TypeScript tooling.
  const code = [
    "import Component from '@glimmer/component';",
    "import { tracked } from '@glimmer/tracking';",
    '',
    'export default class Counter extends Component {',
    '  @tracked count = 0;',
    '  <template>{{this.count}}</template>',
    '}',
  ].join('\n');

  it('parses a class field decorator without throwing', () => {
    const result = parseForESLint(code, {
      filePath: 'fixture.gjs',
      useBabel: true,
    });
    expect(result.ast.type).toBe('Program');

    let decoratorName = null;
    traverse(result.visitorKeys, result.ast, (path) => {
      const decorators = path.node?.decorators;
      if (Array.isArray(decorators) && decorators.length > 0) {
        const expr = decorators[0].expression;
        decoratorName = expr?.name ?? expr?.callee?.name ?? null;
      }
    });
    expect(decoratorName).toBe('tracked');
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
    // through the token stream. Enabling it pins the contract that the
    // JS path emits a populated `program.tokens` — earlier oxc-based
    // implementations shipped an empty array and crashed every rule
    // that walked tokens.
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
