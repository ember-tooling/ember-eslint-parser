'use strict';

const path = require('path');

const parserOptions = {};

parserOptions.projectService = {
  defaultProject: process.env.DEFAULT_PROJECT || process.env.PROJECT || 'tsconfig.json',
  allowDefaultProject: process.env.ALLOW_DEFAULT_PROJECT === 'true' ? ['**/*.js'] : []
};

parserOptions.tsconfigRootDir = process.env.TSCONFIG_ROOT_DIR || __dirname;
parserOptions.project = process.env.PROJECT === undefined ? true : process.env.PROJECT;

const manifestPath = require.resolve('@typescript-eslint/parser/package.json');
const manifest = require(manifestPath);
const isV8 = parseInt(manifest.version[0]) >= 8;

if (isV8) {
  delete parserOptions.project;
}

const ignorePatterns =
  process.env.CHECK_LINT_ERRORS === 'true'
    ? []
    : ['src/example-with-lint-errors.gjs'];

module.exports = {
  root: true,
  parserOptions,
  ignorePatterns,
  rules: {
    'no-constant-condition': ['error'],
    'no-use-before-define': ['error'],
    'no-unused-vars': ['error'],
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-call': 'error'
  },
  overrides: [
    {
      files: ['**/*.{js,ts,gts,gjs}'],
      parser: 'ember-eslint-parser',
    },
    {
      files: ['**/*.{js,ts}'],
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:ember/recommended', 'plugin:@typescript-eslint/recommended-type-checked'],
    },
    {
      files: ['**/*.gts'],
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended-type-checked', 'plugin:ember/recommended', 'plugin:ember/recommended-gts'],
    },
    {
      files: ['**/*.gjs'],
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:ember/recommended', 'plugin:ember/recommended-gjs'],
    },
  ],
}
