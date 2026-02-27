'use strict';

module.exports = {
  root: true,
  rules: {
    'no-unused-vars': ['error'],
  },
  overrides: [
    {
      files: ['**/*.{js,ts}'],
      plugins: ['ember'],
      parser: 'ember-eslint-parser',
      extends: ['eslint:recommended', 'plugin:ember/recommended'],
    },
    {
      files: ['**/*.gts'],
      parser: 'ember-eslint-parser',
      plugins: ['ember'],
      extends: ['eslint:recommended', 'plugin:ember/recommended', 'plugin:ember/recommended-gts'],
    },
  ],
};
