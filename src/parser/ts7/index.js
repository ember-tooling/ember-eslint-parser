import { ts6Backend } from '../ts6/index.js';

/**
 * TypeScript 7: typescript-eslint's experimental tsgo project service
 * (typescript-eslint/typescript-eslint#12803), opted into with
 * `projectService: { EXPERIMENTAL_backend: 'tsgo' }`.
 *
 * tsgo runs in its own process and reads .gts/.gjs through the tsconfig's
 * `contentMappers` (ember-content-mapper). None of the ts6 `ts.sys` shims reach
 * it, and it rejects `extraFileExtensions`.
 */
export function wantsTs7(options) {
  return options.projectService?.EXPERIMENTAL_backend === 'tsgo';
}

function isTemplateTagFile(filePath) {
  return filePath.endsWith('.gts') || filePath.endsWith('.gjs');
}

export const ts7Backend = {
  name: 'ts7',

  /**
   * @param {string} placeholderJS the file with each `<template>` replaced by a same-length placeholder
   * @param {object} options the parser options ESLint passed in
   * @returns {{ code: string, options: object }} what to hand to `@typescript-eslint/parser`
   */
  prepare(placeholderJS, options) {
    return { code: placeholderJS, options };
  },

  finish() {},
};

/**
 * tsgo's AST for a content-mapped file is positioned in the transformed text,
 * not in the file ESLint sees, and the backend does not map it back through the
 * file's `spanMap`. Until that mapping exists, .gts/.gjs files stay on the
 * classic project service; .ts/.js files that import them still get their
 * types from tsgo.
 */
const ts6ForTemplateTags = {
  name: 'ts6 (template-tag fallback)',

  prepare(placeholderJS, options) {
    return ts6Backend.prepare(placeholderJS, { ...options, projectService: true });
  },

  finish(result) {
    ts6Backend.finish(result);
  },
};

export function selectTs7Backend(filePath) {
  return isTemplateTagFile(filePath) ? ts6ForTemplateTags : ts7Backend;
}
