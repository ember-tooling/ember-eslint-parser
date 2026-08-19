'use strict';

// The README's setup: only .gjs/.gts go through ember-eslint-parser, .ts is left
// to @typescript-eslint/parser. See check.mjs.

const manifest = require('@typescript-eslint/parser/package.json');
const isV8 = parseInt(manifest.version, 10) >= 8;

// projectService landed in v8 under this name; older versions get the classic
// watch program.
const useProjectService = process.env.PROJECT_SERVICE && isV8;

module.exports = {
  root: true,
  parserOptions: {
    ...(useProjectService ? { projectService: true } : { project: './tsconfig.json' }),
    tsconfigRootDir: __dirname,
    extraFileExtensions: ['.gts', '.gjs'],
  },
  overrides: [
    {
      files: ['**/*.ts'],
      parser: '@typescript-eslint/parser',
      extends: ['plugin:@typescript-eslint/recommended-type-checked'],
    },
    {
      files: ['**/*.gts'],
      parser: 'ember-eslint-parser',
      extends: ['plugin:@typescript-eslint/recommended-type-checked'],
    },
  ],
};
