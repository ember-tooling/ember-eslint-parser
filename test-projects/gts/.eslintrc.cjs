'use strict';

const manifestPath = require.resolve('@typescript-eslint/parser/package.json');
const manifest = require(manifestPath);
const isV8 = parseInt(manifest.version[0]) >= 8;

module.exports = {
  root: true,
  parserOptions: {
    ...(isV8 ? { projectService: true } : { project: true }),
    tsconfigRootDir: __dirname
  },
  rules: {
    'no-use-before-define': ['error'],
    'no-unused-vars': ['error'],
  },
  overrides: [
    {
      files: ['src-fixable/**/*'],
      rules: {
        'arrow-body-style':["error", "always"],
      },
    },
    {
      files: ['**/*.{js,ts}'],
      plugins: ['ember'],
      parser: 'ember-eslint-parser',
      extends: ['eslint:recommended', 'plugin:ember/recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
    },
    {
      files: ['**/*.gts'],
      parser: 'ember-eslint-parser',
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked', 'plugin:ember/recommended', 'plugin:ember/recommended-gts'],
    },
    {
      files: ['**/*.gjs'],
      parser: 'ember-eslint-parser',
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:ember/recommended', 'plugin:ember/recommended-gjs'],
    },
    {
      // ember-tooling/ember-eslint-parser#255. Core no-use-before-define still
      // reports `<Tree />` inside Tree's own template, which is not fixed yet.
      files: ['src/use-before-define.gts'],
      rules: {
        'no-use-before-define': 'off',
        '@typescript-eslint/no-use-before-define': 'error',
      },
    },
  ],
};
