import { createRequire } from 'node:module';
import path from 'node:path';

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

let forcedVersion;
let isVersionForced = false;
const versionsByDirectory = new Map();

/**
 * Find the `ember-source` version that the linted file uses.
 *
 * The lookup starts at the linted file, not at this parser, because
 * ember-source is a dependency of the project, not of the parser.
 * With pnpm, a lookup from the parser finds only the hoisted copy,
 * which can be a different version in a monorepo.
 *
 * Results are cached per directory.
 *
 * @param {string} [filePath] - the linted file; the current directory if not absolute
 * @returns {string | undefined} the version, or `undefined` if ember-source is not found
 */
export function resolveEmberSourceVersion(filePath) {
  if (isVersionForced) return forcedVersion;

  const directory = filePath && path.isAbsolute(filePath) ? path.dirname(filePath) : process.cwd();

  if (versionsByDirectory.has(directory)) return versionsByDirectory.get(directory);

  let version;
  try {
    const require = createRequire(path.join(directory, 'noop.js'));
    const pkg = require('ember-source/package.json');
    version = typeof pkg?.version === 'string' ? pkg.version : undefined;
  } catch {
    version = undefined;
  }

  versionsByDirectory.set(directory, version);
  return version;
}

/**
 * Test-only: reset the cached `ember-source` version probe.
 */
export function _resetEmberSourceVersionCache() {
  forcedVersion = undefined;
  isVersionForced = false;
  versionsByDirectory.clear();
}

/**
 * Test-only: force the resolved `ember-source` version. Pass `undefined`
 * to act as if `ember-source` is not installed.
 *
 * @param {string | undefined} version
 */
export function _setEmberSourceVersionForTesting(version) {
  forcedVersion = version;
  isVersionForced = true;
}
