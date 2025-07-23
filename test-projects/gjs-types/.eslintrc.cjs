'use strict';

module.exports = {
  root: true,
  parserOptions: {
    project: true,
    projectService: true,
    tsconfigRootDir: __dirname
  },
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
        allowGjs: process.env.ALLOW_GJS !== 'false'
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
