/**
 * Debugging:
 *   https://eslint.org/docs/latest/use/configure/debug
 *  ----------------------------------------------------
 *
 *   Print a file's calculated configuration
 *
 *     npx eslint --print-config path/to/file.hbs
 *
 *   Inspecting the config
 *
 *     npx eslint --inspect-config
 *
 */
import hbsParser from 'ember-eslint-parser/hbs';

export default [
  {
    files: ['**/*.hbs'],
    languageOptions: {
      parser: hbsParser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "GlimmerElementNode[name='Input']",
          message: "Do not use <Input>; use a native <input> element instead.",
        },
      ],
    },
  },
];
