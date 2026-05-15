import { createRequire } from 'node:module';

/**
 * Built-in template keywords shipped from `ember-source` 7.1.0
 * (RFCs 389, 470, 560, 561, 562, 997, 998, 999, 1000). They can be referenced
 * in strict-mode (`.gjs` / `.gts`) templates without an explicit import.
 *
 * `@glimmer/syntax`'s `isKeyword` does not (yet) include these, so the
 * scope-registration pass would otherwise treat `{{eq}}`, `{{on}}`, etc. as
 * free identifiers and ESLint's `no-undef` would flag them.
 *
 * Mirrors Glint's `KeywordsForEmber71` gate in
 * `@glint/ember-tsc/types/-private/dsl/globals.d.ts`.
 */
export const EMBER_71_BUILT_IN_KEYWORDS = new Set([
  'and',
  'array',
  'element',
  'eq',
  'fn',
  'gt',
  'gte',
  'hash',
  'lt',
  'lte',
  'neq',
  'not',
  'on',
  'or',
]);

/**
 * Returns `true` when `name` is one of the Ember 7.1 built-in template
 * keywords AND the supplied `ember-source` version is >= 7.1.0.
 *
 * Pure — accepts the version string instead of reading the filesystem so it
 * is trivially testable.
 *
 * @param {string} name
 * @param {string | undefined | null} version
 * @returns {boolean}
 */
export function isEmber71BuiltInKeywordForVersion(name, version) {
  if (!EMBER_71_BUILT_IN_KEYWORDS.has(name)) return false;
  if (typeof version !== 'string') return false;

  const [major, minor] = version.split('.').map(Number);
  return major > 7 || (major === 7 && minor >= 1);
}

const require = createRequire(import.meta.url);

let cachedVersion;
let cachedVersionResolved = false;

function resolveEmberSourceVersion() {
  if (cachedVersionResolved) return cachedVersion;
  cachedVersionResolved = true;
  try {
    // ember-source is a peer of consumers, not of this parser.
    // eslint-disable-next-line n/no-missing-require, import/no-unresolved
    const pkg = require('ember-source/package.json');
    cachedVersion = typeof pkg?.version === 'string' ? pkg.version : undefined;
  } catch {
    cachedVersion = undefined;
  }
  return cachedVersion;
}

/**
 * Decide whether `name` should be treated as a built-in template keyword
 * given the consumer's installed `ember-source`. Returns `false` when
 * `ember-source` is not resolvable or its version is older than 7.1.0, so
 * pre-7.1 projects keep their existing lint behavior and typos like
 * `{{eq}}` continue to surface as `no-undef`.
 *
 * The probe is cached for the lifetime of the process so this is cheap
 * to call from per-node scope registration.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isEmber71BuiltInKeyword(name) {
  if (!EMBER_71_BUILT_IN_KEYWORDS.has(name)) return false;
  return isEmber71BuiltInKeywordForVersion(name, resolveEmberSourceVersion());
}

/**
 * Test-only: reset the cached `ember-source` version probe.
 */
export function _resetEmberSourceVersionCache() {
  cachedVersion = undefined;
  cachedVersionResolved = false;
}

/**
 * Test-only: force the resolved `ember-source` version. Pass `undefined`
 * to clear and fall back to real probing on the next call.
 *
 * @param {string | undefined} version
 */
export function _setEmberSourceVersionForTesting(version) {
  cachedVersion = version;
  cachedVersionResolved = true;
}
