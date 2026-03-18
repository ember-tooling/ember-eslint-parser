import { createRequire } from 'node:module';
import tsconfigUtils from '@typescript-eslint/tsconfig-utils';
import babelParser from '@babel/eslint-parser/experimental-worker';
import { registerParsedFile } from '../preprocessor/noop.js';
import { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, ts } from './ts-patch.js';
import {
  transformForLint,
  preprocessGlimmerTemplates,
  preprocessGlimmerTemplatesFromCharOffsets,
  convertAst,
} from './transforms.js';
import { isGlintAvailable, getGlintConfig, glintRewriteModule, buildTemplateInfoFromGlint } from './glint-utils.js';
import { remapAstPositions, remapTokens } from './remap.js';

const require = createRequire(import.meta.url);

/**
 * implements https://eslint.org/docs/latest/extend/custom-parsers
 * 1. transforms gts/gjs files into parseable ts/js without changing the offsets and locations around it
 * 2. parses the transformed code and generates the AST for TS ot JS
 * 3. preprocesses the templates info and prepares the Glimmer AST
 * 4. converts the js/ts AST so that it includes the Glimmer AST at the right locations, replacing the original
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

  // If projectService is true, use default behavior (nearest tsconfig.json, allowJs from config)
  if (projectService === true) {
    return 'tsconfig.json';
  }

  // If projectService is an object, handle ProjectServiceOptions
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

  // Existing (non-Glint) path
  let jsCode = code;
  const info = transformForLint(code, options.filePath);
  jsCode = info.output;

  const isTypescript = options.filePath.endsWith('.gts') || options.filePath.endsWith('.ts');
  let useTypescript = true;

  if (options.useBabel || !typescriptParser) {
    useTypescript = false;
  }

  let result = null;
  const filePath = options.filePath;
  if (options.project || options.projectService) {
    jsCode = replaceExtensions(jsCode);
  }

  if (isTypescript && !typescriptParser) {
    throw new Error('Please install typescript to process gts');
  }

  try {
    result =
      isTypescript || useTypescript
        ? typescriptParser.parseForESLint(jsCode, {
            ...options,
            ranges: true,
            extraFileExtensions: ['.gts', '.gjs'],
            filePath,
          })
        : babelParser.parseForESLint(jsCode, {
            ...options,
            requireConfigFile: false,
            ranges: true,
          });
    if (!info.templateInfos?.length) {
      return result;
    }
    const preprocessedResult = preprocessGlimmerTemplates(info, code);
    preprocessedResult.code = code;
    const { templateVisitorKeys } = preprocessedResult;
    const visitorKeys = { ...result.visitorKeys, ...templateVisitorKeys };
    result.isTypescript = isTypescript || useTypescript;
    convertAst(result, preprocessedResult, visitorKeys);
    if (result.services?.program) {
      syncMtsGtsSourceFiles(result.services.program);
    }
    return { ...result, visitorKeys };
  } catch (e) {
    console.error(e);
    throw e;
  }
}

export default { meta, parseForESLint };
