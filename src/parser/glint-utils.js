import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let glintAvailable = false;
let rewriteModule, ConfigLoader;

try {
  ({ rewriteModule } = require('@glint/ember-tsc/transform'));
  ({ ConfigLoader } = require('@glint/ember-tsc'));
  glintAvailable = true;
} catch {
  // @glint/ember-tsc not installed
}

const configLoader = glintAvailable ? new ConfigLoader() : null;

/**
 * @returns {boolean}
 */
export function isGlintAvailable() {
  return glintAvailable;
}

/**
 * Loads and caches GlintConfig for the project containing filePath.
 * Returns null if @glint/ember-tsc is not available or no glint
 * environment is configured in the project's tsconfig.
 * @param {string} filePath
 * @returns {import('@glint/ember-tsc').GlintConfig | null}
 */
export function getGlintConfig(filePath) {
  if (!configLoader) return null;
  try {
    const config = configLoader.configForFile(filePath);
    if (!config || config.environment.names.length === 0) return null;
    return config;
  } catch {
    return null;
  }
}

/**
 * Rewrites a .gts/.gjs module using Glint's template-to-TypeScript transform.
 * Returns TransformedModule or null if no templates found / transform not needed.
 * @param {string} code - file contents
 * @param {string} filePath - absolute file path
 * @param {*} ts - TypeScript instance
 * @param {import('@glint/ember-tsc').GlintConfig} config - Glint config
 * @returns {{ transformedContents: string } | null}
 */
export function glintRewriteModule(code, filePath, ts, config) {
  if (!rewriteModule) return null;
  return rewriteModule(ts, { script: { filename: filePath, contents: code } }, config.environment);
}

/**
 * Build template info objects from a Glint TransformedModule's correlatedSpans.
 * Returns template ranges in character (UTF-16) offsets suitable for
 * preprocessGlimmerTemplatesFromCharOffsets.
 *
 * @param {object} transformedModule - Glint TransformedModule
 * @returns {Array<{ range: [number, number] }>}
 */
export function buildTemplateInfoFromGlint(transformedModule) {
  const result = [];
  const seen = new Set();
  for (const span of transformedModule.correlatedSpans) {
    if (!span.glimmerAstMapping) continue;

    const fullStart = span.originalStart;
    // Deduplicate: multiple spans can map to the same original template
    if (seen.has(fullStart)) continue;
    seen.add(fullStart);

    const fullEnd = span.originalStart + span.originalLength;

    result.push({
      range: [fullStart, fullEnd],
    });
  }
  return result;
}
