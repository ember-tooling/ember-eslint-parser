import { createRequire } from 'node:module';
import tsconfigUtils from '@typescript-eslint/tsconfig-utils';
import { registerParsedFile } from '../preprocessor/noop.js';
import {
  patchTs,
  replaceExtensions,
  syncMtsGtsSourceFiles,
  typescriptParser,
  ts,
} from './ts-patch.js';
import {
  buildGlimmerVisitors,
  preprocessGlimmerTemplatesFromCharOffsets,
  convertAst,
} from './transforms.js';
import {
  isGlintAvailable,
  getGlintConfig,
  glintRewriteModule,
  buildTemplateInfoFromGlint,
} from './glint-utils.js';
import { remapAstPositions, remapTokens } from './remap.js';
import { toTree } from 'ember-estree';
import * as eslintScope from 'eslint-scope';

const require = createRequire(import.meta.url);

/**
 * implements https://eslint.org/docs/latest/extend/custom-parsers
 *
 * Uses ember-estree's toTree with a custom parser option to handle
 * the full pipeline: template extraction, placeholder replacement,
 * JS/TS parsing, Glimmer AST processing, and AST splicing.
 *
 * Scope registration happens via toTree's visitors API, eliminating
 * a second AST traversal.
 */

/**
 * @param {string} tsconfigPath
 * @param {string} rootDir
 * @returns {boolean|undefined}
 */
function parseAllowJsFromTsconfig(tsconfigPath, rootDir) {
  try {
    const parserPath = require.resolve('@typescript-eslint/parser');
    // eslint-disable-next-line n/no-unpublished-require
    const tsPath = require.resolve('typescript', { paths: [parserPath] });
    const ts = require(tsPath);
    const parsed = tsconfigUtils.getParsedConfigFile(ts, tsconfigPath, rootDir);
    return parsed?.options?.allowJs;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[ember-eslint-parser] Failed to parse tsconfig:', tsconfigPath, e);
    return undefined;
  }
}

/**
 * @param {Array<boolean|undefined>} values
 * @param {string} source
 * @returns {boolean|null}
 */
function resolveAllowJs(values, source) {
  const filtered = values.filter((val) => typeof val !== 'undefined');
  if (filtered.length > 0) {
    const uniqueValues = [...new Set(filtered)];
    if (uniqueValues.length > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ember-eslint-parser] Conflicting allowJs values in ${source}. Defaulting allowGjs to false.`
      );
      return false;
    } else {
      return uniqueValues[0];
    }
  }
  return null;
}

/**
 * @param {Array<{getCompilerOptions?: Function}>|undefined} programs
 * @returns {boolean|null}
 */
function getAllowJsFromPrograms(programs) {
  if (!Array.isArray(programs) || programs.length === 0) return null;
  const allowJsValues = programs
    .map((p) => p.getCompilerOptions?.())
    .filter(Boolean)
    .map((opts) => opts.allowJs);
  return resolveAllowJs(allowJsValues, 'programs');
}

/**
 * @param {boolean|object|undefined} projectService
 * @returns {string|null}
 */
function getProjectServiceTsconfigPath(projectService) {
  if (!projectService) return null;

  if (projectService === true) {
    return 'tsconfig.json';
  }

  if (typeof projectService === 'object') {
    if (typeof projectService.allowDefaultProject !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(
        '[ember-eslint-parser] projectService.allowDefaultProject is specified. Behavior may differ depending on default project config.'
      );
    }
    return projectService.defaultProject ?? 'tsconfig.json';
  }

  return null;
}

/**
 * Returns the resolved allowJs value based on priority: programs > projectService > project/tsconfig
 */
function getAllowJs(options) {
  const allowJsFromPrograms = getAllowJsFromPrograms(options.programs);
  if (allowJsFromPrograms !== null) return allowJsFromPrograms;

  const rootDir = options.tsconfigRootDir || process.cwd();

  const projectServiceTsconfigPath = getProjectServiceTsconfigPath(options.projectService);
  if (projectServiceTsconfigPath) {
    return parseAllowJsFromTsconfig(projectServiceTsconfigPath, rootDir);
  }

  let tsconfigPaths = [];
  if (Array.isArray(options.project)) {
    tsconfigPaths = options.project;
  } else if (typeof options.project === 'string') {
    tsconfigPaths = [options.project];
  } else if (options.project) {
    tsconfigPaths = ['tsconfig.json'];
  }
  if (tsconfigPaths.length > 0) {
    const allowJsValues = tsconfigPaths.map((cfg) => parseAllowJsFromTsconfig(cfg, rootDir));
    return resolveAllowJs(allowJsValues, 'project');
  }

  return false;
}

/**
 * Parse using Glint's transform for full type-aware template support.
 * Glint transforms templates into __glintDSL__ calls that TS understands,
 * then we remap AST positions back to original source and splice in Glimmer AST.
 */
function parseWithGlint(code, options, transformedModule) {
  const filePath = options.filePath;

  // Get transformed TS code and replace .gts→.mts imports
  let tsCode = transformedModule.transformedContents;
  if (options.project || options.projectService) {
    tsCode = replaceExtensions(tsCode);
  }

  // Parse the transformed code with TS parser (positions in transformed-space)
  const result = typescriptParser.parseForESLint(tsCode, {
    ...options,
    ranges: true,
    extraFileExtensions: ['.gts', '.gjs'],
    filePath,
  });

  // Build template infos from Glint's correlatedSpans
  const glintTemplateInfos = buildTemplateInfoFromGlint(transformedModule, filePath);

  // Always remap positions even if no templates — Glint may have changed code length
  // for non-template spans (e.g., directive placeholders)
  const { templateSpans } = remapAstPositions(
    result.ast,
    result.visitorKeys,
    transformedModule.correlatedSpans,
    code
  );

  // Remap tokens
  result.ast.tokens = remapTokens(
    result.ast.tokens,
    transformedModule.correlatedSpans,
    templateSpans,
    code
  );

  if (!glintTemplateInfos.length) {
    return result;
  }

  // Preprocess Glimmer templates (parse to Glimmer AST with correct positions)
  const preprocessedResult = preprocessGlimmerTemplatesFromCharOffsets(glintTemplateInfos, code);
  const { templateVisitorKeys } = preprocessedResult;
  const visitorKeys = { ...result.visitorKeys, ...templateVisitorKeys };
  result.isTypescript = true;

  // Splice Glimmer AST into the remapped TS AST (matchByRangeOnly because
  // Glint produces different node types than transformForLint)
  convertAst(result, preprocessedResult, visitorKeys, { matchByRangeOnly: true });

  if (result.services?.program) {
    syncMtsGtsSourceFiles(result.services.program);
  }

  return { ...result, visitorKeys };
}

/**
 * @type {import('eslint').ParserModule}
 */
export const meta = {
  name: 'ember-eslint-parser',
  version: '*',
};

export function parseForESLint(code, options) {
  const allowGjs = options.allowGjs !== undefined ? options.allowGjs : getAllowJs(options);
  // Only patch TypeScript if we actually need it.
  if (options.programs || options.projectService || options.project) {
    patchTs({ allowGjs });
  }
  registerParsedFile(options.filePath);

  // Try Glint path for .gts/.gjs files when Glint is available
  const isGts = options.filePath.endsWith('.gts');
  const isGjs = options.filePath.endsWith('.gjs');
  if ((isGts || isGjs) && isGlintAvailable() && ts && typescriptParser) {
    try {
      const glintConfig = getGlintConfig(options.filePath);
      if (glintConfig) {
        const glintTransform = glintRewriteModule(code, options.filePath, ts, glintConfig);
        if (glintTransform) {
          return parseWithGlint(code, options, glintTransform);
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[ember-eslint-parser] Glint path failed, falling back:', e.stack || e.message);
    }
  }

  const isTypescript = options.filePath.endsWith('.gts') || options.filePath.endsWith('.ts');
  let useTypescript = true;

  if (options.useBabel || !typescriptParser) {
    useTypescript = false;
  }

  if (isTypescript && !typescriptParser) {
    throw new Error('Please install typescript to process gts');
  }

  const filePath = options.filePath;
  const useTS = isTypescript || useTypescript;

  // Both paths create scopeManager inside the parser callback so it's
  // available when toTree invokes visitors during splice — no second pass.
  let scopeManager = null;

  try {
    const result = toTree(code, {
      filePath,
      parser: useTS
        ? (placeholderJS) => {
            let parseCode = placeholderJS;
            if (options.project || options.projectService) {
              parseCode = replaceExtensions(parseCode);
            }
            const tsResult = typescriptParser.parseForESLint(parseCode, {
              ...options,
              ranges: true,
              extraFileExtensions: ['.gts', '.gjs'],
              filePath,
            });
            scopeManager = tsResult.scopeManager;
            return tsResult;
          }
        : (placeholderJS) => {
            // JS path: parse with oxc, create scope manager from placeholder AST
            const { parseSync } = require('oxc-parser');
            const oxcResult = parseSync(filePath || 'input.js', placeholderJS);
            const program = oxcResult.program;
            program.tokens = oxcResult.tokens || [];
            program.comments = oxcResult.comments || [];
            scopeManager = eslintScope.analyze(program, {
              ecmaVersion: 2022,
              sourceType: 'module',
              range: true,
            });
            return { ast: program, scopeManager };
          },
      visitors: buildGlimmerVisitors(() => scopeManager, useTS),
    });

    if (!result.scopeManager) result.scopeManager = scopeManager;

    if (result.services?.program) {
      syncMtsGtsSourceFiles(result.services.program);
    }

    delete result.templateInfos;
    delete result.isTypescript;

    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e);
    // Convert content-tag parse errors to ESLint-compatible format
    if (e.message?.includes('Parse Error at')) {
      const [line, column] = e.message
        .split(':')
        .slice(-2)
        .map((x) => parseInt(x));
      const err = new Error(e.source_code || e.message);
      err.lineNumber = line;
      err.column = column;
      err.fileName = filePath;
      err.index = undefined;
      throw err;
    }
    throw e;
  }
}

export default { meta, parseForESLint };
