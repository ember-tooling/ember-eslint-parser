# ember-eslint-parser

This is the eslint parser for ember's gjs and gts files (using `<template>`), and also for Handlebars (`.hbs`) template files.

It is meant to be used with [eslint-plugin-ember](https://github.com/ember-cli/eslint-plugin-ember), which provides nice defaults for all the different file types in ember projects.

It's recommended to only use _overrides_ when defining your eslint config, so using this parser would look like this:
```js 
    {
      files: ['**/*.gjs'],
      parser: 'ember-eslint-parser',
      plugins: ['ember'],
      extends: [
        'eslint:recommended',
        'plugin:ember/recommended',
        'plugin:ember/recommended-gjs',
      ],
    },
    {
      files: ['**/*.gts'],
      parser: 'ember-eslint-parser',
      plugins: ['ember'],
      extends: [
        'eslint:recommended',
        'plugin:ember/recommended',
        'plugin:ember/recommended-gts',
      ],
    },
```

if we detect a typescript parser, it will also be used for all files, otherwise babel parser will be used.
If we cannot find a typescript parser when linting gts we throw an error. 

If you use type-aware rules, route `.js`/`.ts` through this parser too, as
`eslint-plugin-ember`'s configs do:

```js
    {
      files: ['**/*.{js,ts}'],
      parser: 'ember-eslint-parser',
      // ...
    },
```

`@typescript-eslint/parser` hands TypeScript the source as ESLint read it, so a
`.ts` file importing from a `.gts` gets an `error` type for that import. This
parser rewrites the specifier first.

## HBS (Handlebars) support

For `.hbs` template files, use the `ember-eslint-parser/hbs` parser. In ESLint's flat config format (ESLint 9+):

```js
// eslint.config.mjs
import hbsParser from 'ember-eslint-parser/hbs';

export default [
  {
    files: ['**/*.hbs'],
    languageOptions: {
      parser: hbsParser,
    },
  },
];
```

> **Note:** In `.hbs` files, all locals not defined in the template are assumed to be defined at runtime. This avoids false-positive `no-undef` errors for template identifiers. This is a known limitation of the classic HBS format — use `.gjs`/`.gts` for full static analysis.

## Support

eslint-plugin-ember is the primary consumer of this parser library, so SemVer _may_ not be respected for other consumers.
