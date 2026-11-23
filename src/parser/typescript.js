import { ts6Backend } from './ts6/index.js';
import { selectTs7Backend, wantsTs7 } from './ts7/index.js';

export { typescriptParser } from './typescript-parser.js';

/**
 * Picks how type information is produced for one file.
 *
 * @param {object} options the parser options ESLint passed in
 * @returns {{ name: string, prepare: Function, finish: Function }}
 */
export function selectTypescriptBackend(options) {
  return wantsTs7(options) ? selectTs7Backend(options.filePath) : ts6Backend;
}
