/**
 * ComponentName — description with an em-dash
 *
 * This file tests that non-ASCII characters (em-dash "—", which is 3 bytes
 * in UTF-8 but 1 character in UTF-16) before a .gts import do not cause
 * replaceExtensions to corrupt the import path.
 *
 * See: https://github.com/ember-tooling/ember-eslint-parser/issues/163
 */

import type DynamicTarget from './dynamic-target.gts';

const load = async (): Promise<typeof DynamicTarget> => {
  const mod = await import('./dynamic-target.gts');
  return mod.default;
};

export { load };
