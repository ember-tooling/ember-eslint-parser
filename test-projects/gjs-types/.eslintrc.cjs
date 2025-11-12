'use strict';

const parserOptions = {};
if (process.env.PROJECT_SERVICE) {
  parserOptions.projectService = {
    defaultProject: process.env.DEFAULT_PROJECT || 'tsconfig.json',
    allowDefaultProject: process.env.ALLOW_DEFAULT_PROJECT === 'true' ? ['**/*.js'] : []
  };
}

parserOptions.tsconfigRootDir = process.env.TSCONFIG_ROOT_DIR || __dirname;
parserOptions.project = process.env.PROJECT === undefined ? true : process.env.PROJECT;

module.exports = {
  root: true,
  parserOptions,
  rules: {
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
      parserOptions: {
        allowGjs: process.env.ALLOW_GJS !== undefined ? process.env.ALLOW_GJS === 'true' : undefined
      }
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
