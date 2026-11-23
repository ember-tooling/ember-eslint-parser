import { replaceExtensions, syncMtsGtsSourceFiles } from './ts-patch.js';

/**
 * TypeScript 6 and earlier: typescript-eslint's classic program or project service.
 *
 * The program runs in this process, so ts-patch.js patches its `ts.sys`:
 * each .gts/.gjs file is read as placeholder JS under a .mts/.mjs twin.
 * Importing this module applies that patch (see ts-patch.js for why it must
 * happen at load time).
 */
export const ts6Backend = {
  name: 'ts6',

  /**
   * @param {string} placeholderJS the file with each `<template>` replaced by a same-length placeholder
   * @param {object} options the parser options ESLint passed in
   * @returns {{ code: string, options: object }} what to hand to `@typescript-eslint/parser`
   */
  prepare(placeholderJS, options) {
    const typeAware = options.project || options.projectService;
    return {
      code: typeAware ? replaceExtensions(placeholderJS) : placeholderJS,
      options: { ...options, extraFileExtensions: ['.gts', '.gjs'] },
    };
  },

  /**
   * @param {object} result the `parseForESLint` result
   */
  finish(result) {
    if (result.services?.program) {
      syncMtsGtsSourceFiles(result.services.program);
    }
  },
};
