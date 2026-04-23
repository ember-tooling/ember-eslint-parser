/**
 * Regression tests for `{{! eslint-disable-* }}` directives inside
 * `<template>` blocks.
 *
 * ESLint's inline-config scanner (SourceCode#getInlineConfigNodes) only
 * reads `Program.comments`. Any template-comment handling that drops
 * those nodes, or leaves them in a shape the scanner rejects, silently
 * breaks `{{! eslint-disable-* }}` suppression in .gjs/.gts and .hbs
 * files. These tests pin the end-to-end contract by running a real
 * `Linter` pass against a stub rule — no downstream plugins required.
 *
 * Background: ember-estree 0.4.3 (NullVoxPopuli/ember-estree#31)
 * flipped the default so Glimmer comment nodes stay in
 * `GlimmerTemplate.body` and no longer flow into `Program.comments`,
 * silently regressing every consumer here. These tests exist to catch
 * that class of change before it ships.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parseForESLint as gjsParseForESLint } from '../src/parser/gjs-gts-parser.js';
import { parseForESLint as hbsParseForESLint } from '../src/parser/hbs-parser.js';

function makeLinter({ parser, parserName }) {
  const linter = new Linter();
  linter.defineParser(parserName, { parseForESLint: parser });
  // Stub rule with a clearly identifiable message so the assertions
  // don't depend on any specific plugin being installed.
  linter.defineRule('regression/concat-flag', {
    create(context) {
      return {
        GlimmerConcatStatement(node) {
          context.report({ node, message: 'flagged concat' });
        },
      };
    },
  });
  return linter;
}

function verify(linter, code, { parserName, filename }) {
  return linter.verify(
    code,
    {
      parser: parserName,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
      rules: { 'regression/concat-flag': 'error' },
    },
    { filename }
  );
}

function flagged(messages) {
  return messages.filter((m) => m.ruleId === 'regression/concat-flag');
}

describe('{{! eslint-disable-* }} directives inside <template> — .gts', () => {
  const linter = makeLinter({ parser: gjsParseForESLint, parserName: 'ember-eslint-parser' });
  const run = (code) =>
    verify(linter, code, { parserName: 'ember-eslint-parser', filename: 'test.gts' });

  it('sanity: the stub rule fires when there is no directive', () => {
    const code = ['<template>', '  <li aria-current="{{foo}}"></li>', '</template>'].join('\n');
    expect(flagged(run(code))).toHaveLength(1);
  });

  it('{{! eslint-disable-next-line regression/concat-flag }} suppresses the next line', () => {
    const code = [
      '<template>',
      '  <li',
      '    {{! eslint-disable-next-line regression/concat-flag }}',
      '    aria-current="{{foo}}"',
      '  ></li>',
      '</template>',
    ].join('\n');
    expect(flagged(run(code))).toEqual([]);
  });

  it('{{!-- eslint-disable-next-line regression/concat-flag --}} (long-form) suppresses the next line', () => {
    const code = [
      '<template>',
      '  <li',
      '    {{!-- eslint-disable-next-line regression/concat-flag --}}',
      '    aria-current="{{foo}}"',
      '  ></li>',
      '</template>',
    ].join('\n');
    expect(flagged(run(code))).toEqual([]);
  });

  it('{{! eslint-disable regression/concat-flag }} … {{! eslint-enable }} suppresses the block', () => {
    const code = [
      '<template>',
      '  {{! eslint-disable regression/concat-flag }}',
      '  <li aria-current="{{foo}}"></li>',
      '  <li aria-current="{{bar}}"></li>',
      '  {{! eslint-enable regression/concat-flag }}',
      '  <li aria-current="{{baz}}"></li>',
      '</template>',
    ].join('\n');
    const msgs = flagged(run(code));
    // Only the line after `eslint-enable` should still flag.
    expect(msgs).toHaveLength(1);
  });

  it('directive before a <template> block suppresses a violation inside it', () => {
    // `{{! }}` lives inside the Glimmer region, but a standard JS block
    // comment just before the <template> expression should also reach
    // the same scanner — ensures the JS-side comment stream is intact.
    const code = [
      'const x = 1;',
      '/* eslint-disable-next-line regression/concat-flag */',
      'const y = <template><li aria-current="{{foo}}"></li></template>;',
    ].join('\n');
    expect(flagged(run(code))).toEqual([]);
  });
});

describe('{{! eslint-disable-* }} directives inside a template — .hbs', () => {
  const linter = makeLinter({ parser: hbsParseForESLint, parserName: 'ember-eslint-parser/hbs' });
  const run = (code) =>
    verify(linter, code, { parserName: 'ember-eslint-parser/hbs', filename: 'test.hbs' });

  it('sanity: the stub rule fires when there is no directive', () => {
    const code = '<li aria-current="{{foo}}"></li>';
    expect(flagged(run(code))).toHaveLength(1);
  });

  it('{{! eslint-disable-next-line regression/concat-flag }} suppresses the next line', () => {
    const code = [
      '<li',
      '  {{! eslint-disable-next-line regression/concat-flag }}',
      '  aria-current="{{foo}}"',
      '></li>',
    ].join('\n');
    expect(flagged(run(code))).toEqual([]);
  });
});

describe('Program.comments shape expected by ESLint consumers', () => {
  // ESLint's `SourceCode#getInlineConfigNodes` reads `ast.comments`,
  // filters out `type: 'Shebang'`, and for `eslint-disable-next-line`
  // accepts any comment type except `'Line'`. Most plugin rules that
  // iterate `sourceCode.getAllComments()` additionally filter on
  // `type === 'Block'` (e.g. eslint-plugin-ember's
  // template-no-html-comments). Pin both expectations at the parser
  // boundary so a future ember-estree shape change that silently loses
  // either trips a specific test rather than vague downstream fallout.

  it('.gts: directive-shaped template comments surface in Program.comments', () => {
    const source = [
      'const X = <template>',
      '  <li',
      '    {{! eslint-disable-next-line regression/concat-flag }}',
      '    aria-current="{{foo}}"',
      '  ></li>',
      '</template>;',
    ].join('\n');
    const { ast } = gjsParseForESLint(source, {
      filePath: 'test.gts',
      range: true,
      loc: true,
      comment: true,
      tokens: true,
    });
    const directives = (ast.comments || []).filter(
      (c) => typeof c.value === 'string' && /^\s*eslint-disable-next-line\s/.test(c.value)
    );
    expect(directives).toHaveLength(1);
    expect(directives[0].value.trim()).toBe('eslint-disable-next-line regression/concat-flag');
    // Most plugin rules iterate `getAllComments()` and filter on `Block`.
    expect(directives[0].type).toBe('Block');
  });

  it('.hbs: directive-shaped template comments surface in Program.comments', () => {
    const source = [
      '<li',
      '  {{! eslint-disable-next-line regression/concat-flag }}',
      '  aria-current="{{foo}}"',
      '></li>',
    ].join('\n');
    const { ast } = hbsParseForESLint(source, { filePath: 'test.hbs' });
    const directives = (ast.comments || []).filter(
      (c) => typeof c.value === 'string' && /^\s*eslint-disable-next-line\s/.test(c.value)
    );
    expect(directives).toHaveLength(1);
    expect(directives[0].type).toBe('Block');
  });
});
