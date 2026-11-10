import emberParser from 'ember-eslint-parser';
import ts from 'typescript-eslint';

export default ts.config(
  {
    files: ['**/*.{ts,gts}'],
    extends: [ts.configs.recommendedTypeChecked],
    languageOptions: {
      parser: emberParser,
      parserOptions: {
        projectService: { EXPERIMENTAL_backend: 'tsgo', EXPERIMENTAL_runExternalCode: true },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src-fixable/**'],
    rules: {
      'arrow-body-style': ['error', 'always'],
    },
  }
);
