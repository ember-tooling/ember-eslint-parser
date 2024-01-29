module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  extends: ['standard', 'plugin:prettier/recommended', 'plugin:n/recommended'],
  overrides: [
    {
      env: {
        node: true,
      },
      files: ['.eslintrc.{js,cjs}'],
      parserOptions: {
        sourceType: 'script',
      },
    },
    {
      env: {
        node: true,
      },
      files: ['tests/**/*.js'],
      parserOptions: {
        sourceType: 'module',
      },
    },
  ],
  ignorePatterns: ['tests/fixtures/**/*.js'],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  rules: {},
};
