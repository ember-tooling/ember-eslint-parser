import ember from 'eslint-plugin-ember/recommended';
import babelParser from '@babel/eslint-parser';
import emberParser from 'ember-eslint-parser';
import noop from 'ember-eslint-parser/noop';

const esmParserOptions = {
  ecmaFeatures: { modules: true },
  ecmaVersion: 'latest',
};

export default [
  ember.configs.base,
  ember.configs.gjs,
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '!**/.*'],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
    },
  },
  {
    files: ['**/*.{js,gjs}'],
    languageOptions: {
      parserOptions: esmParserOptions,
    },
  },
  /**
   * eslint-plugin-ember links the workspace root copy of
   * the parser, which finds Babel 7 in the root node_modules.
   * This project injects its own copy, so it finds Babel 8.
   * The processor must come from the same copy as the parser.
   */
  {
    files: ['**/*.gjs'],
    processor: { ...noop, preprocess: (text) => [text] },
    languageOptions: {
      parser: emberParser,
      parserOptions: { useBabel: true },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'error',
    },
  },
];
