import ember from 'eslint-plugin-ember/recommended';
import babelParser from '@babel/eslint-parser';

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
];
