let glintAvailable = false;
let rewriteModule, ConfigLoader;

try {
  ({ rewriteModule } = require('@glint/ember-tsc/transform'));
  ({ ConfigLoader } = require('@glint/ember-tsc'));
  glintAvailable = true;
} catch {
  // @glint/ember-tsc not installed or Node too old for ESM require()
}

const configLoader = glintAvailable ? new ConfigLoader() : null;

/**
 * @returns {boolean}
 */
function isGlintAvailable() {
  return glintAvailable;
}

/**
 * Loads and caches GlintConfig for the project containing filePath.
 * Returns null if @glint/ember-tsc is not available or no glint
 * environment is configured in the project's tsconfig.
 * @param {string} filePath
 * @returns {import('@glint/ember-tsc').GlintConfig | null}
 */
function getGlintConfig(filePath) {
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
function glintRewriteModule(code, filePath, ts, config) {
  if (!rewriteModule) return null;
  return rewriteModule(
    ts,
    { script: { filename: filePath, contents: code } },
    config.environment
  );
}

/**
 * Build template info objects from a Glint TransformedModule's correlatedSpans.
 * Returns template ranges in character (UTF-16) offsets suitable for
 * preprocessGlimmerTemplatesFromCharOffsets.
 *
 * @param {object} transformedModule - Glint TransformedModule
 * @param {string} originalFileName - original file path
 * @returns {Array<{ range: [number, number], contentRange: [number, number] }>}
 */
function buildTemplateInfoFromGlint(transformedModule, originalFileName) {
  const result = [];
  for (const span of transformedModule.correlatedSpans) {
    if (!span.glimmerAstMapping) continue;

    const fullStart = span.originalStart;
    const fullEnd = span.originalStart + span.originalLength;

    // Use findTemplateAtOriginalOffset to get content bounds (excludes <template> tags)
    const tplInfo = transformedModule.findTemplateAtOriginalOffset(originalFileName, fullStart);
    if (!tplInfo) continue;

    result.push({
      range: [fullStart, fullEnd],
      contentRange: [tplInfo.originalContentStart, tplInfo.originalContentEnd],
    });
  }
  return result;
}

module.exports = { isGlintAvailable, getGlintConfig, glintRewriteModule, buildTemplateInfoFromGlint };
