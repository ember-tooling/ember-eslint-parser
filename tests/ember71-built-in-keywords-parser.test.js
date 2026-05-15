import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';
import {
  _resetEmberSourceVersionCache,
  _setEmberSourceVersionForTesting,
} from '../src/parser/ember71-built-in-keywords.js';

/**
 * End-to-end tests for the Ember 7.1 built-in template keyword bail-out
 * inside `registerPathExpression`. We force the resolved ember-source
 * version so the tests don't depend on having `ember-source` installed
 * in this repo, and we drive ESLint's `no-undef` and `no-unused-vars`
 * rules against the parser output because that's the user-visible
 * behavior we care about:
 *
 *   - bare `{{eq}}` must not be flagged as `no-undef` on >= 7.1
 *   - `import { eq } from '…'` must still be marked as used by
 *     `no-unused-vars` (the local binding shadows the built-in)
 *   - bare `{{eq}}` must STILL be flagged as `no-undef` on < 7.1 or
 *     when ember-source is unresolvable, so typos still surface.
 */
describe('parser — Ember 7.1 built-in template keywords (lint behavior)', () => {
  /** @type {Linter} */
  let linter;
  const PARSER_NAME = 'gjs-parser';

  beforeEach(() => {
    linter = new Linter();
    linter.defineParser(PARSER_NAME, { parseForESLint });
  });

  function lint(code) {
    return linter.verify(
      code,
      {
        parser: PARSER_NAME,
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        rules: { 'no-undef': 'error', 'no-unused-vars': 'error' },
      },
      { filename: 'fixture.gjs' }
    );
  }

  describe('with ember-source >= 7.1 resolvable', () => {
    beforeEach(() => _setEmberSourceVersionForTesting('7.1.0'));
    afterEach(() => _resetEmberSourceVersionCache());

    it('does not flag a bare 7.1 keyword as no-undef', () => {
      const messages = lint(['<template>', '  {{eq 1 2}}', '</template>'].join('\n'));
      expect(messages.filter((m) => m.ruleId === 'no-undef')).toEqual([]);
    });

    it('does not flag a user import of a 7.1 keyword as no-unused-vars (shadows the built-in)', () => {
      const messages = lint(
        [
          "import { eq } from 'ember-truth-helpers';",
          '',
          'export default <template>',
          '  {{eq 1 2}}',
          '</template>;',
        ].join('\n')
      );
      expect(messages.filter((m) => m.ruleId === 'no-unused-vars')).toEqual([]);
      expect(messages.filter((m) => m.ruleId === 'no-undef')).toEqual([]);
    });

    it('still flags an unrelated free identifier as no-undef', () => {
      const messages = lint(['<template>', '  {{notDefinedAnywhere}}', '</template>'].join('\n'));
      const undefMessages = messages.filter((m) => m.ruleId === 'no-undef');
      expect(undefMessages).toHaveLength(1);
      expect(undefMessages[0].message).toMatch(/notDefinedAnywhere/);
    });
  });

  describe('with ember-source older than 7.1', () => {
    beforeEach(() => _setEmberSourceVersionForTesting('7.0.5'));
    afterEach(() => _resetEmberSourceVersionCache());

    it('flags a bare 7.1 keyword as no-undef', () => {
      const messages = lint(['<template>', '  {{eq 1 2}}', '</template>'].join('\n'));
      const undefMessages = messages.filter((m) => m.ruleId === 'no-undef');
      expect(undefMessages).toHaveLength(1);
      expect(undefMessages[0].message).toMatch(/eq/);
    });
  });

  describe('with ember-source unresolvable', () => {
    beforeEach(() => _setEmberSourceVersionForTesting(undefined));
    afterEach(() => _resetEmberSourceVersionCache());

    it('flags a bare 7.1 keyword as no-undef', () => {
      const messages = lint(['<template>', '  {{eq 1 2}}', '</template>'].join('\n'));
      const undefMessages = messages.filter((m) => m.ruleId === 'no-undef');
      expect(undefMessages).toHaveLength(1);
      expect(undefMessages[0].message).toMatch(/eq/);
    });
  });
});
