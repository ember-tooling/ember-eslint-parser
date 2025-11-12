'use strict';


parserOptions.tsconfigRootDir = process.env.TSCONFIG_ROOT_DIR || __dirname;
parserOptions.project = process.env.PROJECT === undefined ? true : process.env.PROJECT;

const manifestPath = require.resolve('@typescript-eslint/parser/package.json');
const manifest = require(manifestPath);
const isV8 = parseInt(manifest.version[0]) >= 8;

module.exports = {
  root: true,
  parserOptions: {
    ...(isV8 ? {} : { project: true }),
    projectService: true,
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
  ],
};
