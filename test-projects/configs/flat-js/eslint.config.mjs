import globals from 'globals';
import js from '@eslint/js';
import e from 'eslint-plugin-ember';

import ember from 'eslint-plugin-ember/configs/recommended';
import emberGJS from 'eslint-plugin-ember/configs/recommended-gjs';

import emberParser from 'ember-eslint-parser';
import babelParser from '@babel/eslint-parser';

export default [
  js.configs.recommended,
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 'latest',
        requireConfigFile: false,
        babelOptions: {
          plugins: [['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }]],
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      ember: e,
    },
    rules: {
      ...ember.rules,
      ...emberGJS.rules,
    },
  },
  {
    files: ['**/*.gjs'],
    languageOptions: {
      parser: emberParser,
      parserOptions: {
        ecmaFeatures: { modules: true },
        ecmaVersion: 'latest',
        requireConfigFile: false,
        babelOptions: {
          plugins: [['@babel/plugin-proposal-decorators', { decoratorsBeforeExport: true }]],
        },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      ember: e,
    },
    rules: {
      ...ember.rules,
      ...emberGJS.rules,
    },
  },
];
