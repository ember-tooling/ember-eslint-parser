'use strict';

module.exports = {
  root: true,
  parserOptions: {
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
