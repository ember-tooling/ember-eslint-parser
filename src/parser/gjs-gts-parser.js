import { createRequire } from 'node:module';
import tsconfigUtils from '@typescript-eslint/tsconfig-utils';
import { registerParsedFile } from '../preprocessor/noop.js';
import { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser } from './ts-patch.js';
import { buildGlimmerVisitors } from './transforms.js';
import { toTree } from 'ember-estree';
import { parseSync } from 'oxc-parser';
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
 * @type {import('eslint').ParserModule}
 */
export const meta = {
  name: 'ember-eslint-parser',
  version: '*',
};

export function parseForESLint(code, options) {
  const allowGjsWasSet = options.allowGjs !== undefined;
  const allowGjs = allowGjsWasSet ? options.allowGjs : getAllowJs(options);
  let actualAllowGjs;
  // Only patch TypeScript if we actually need it.
  if (options.programs || options.projectService || options.project) {
    ({ allowGjs: actualAllowGjs } = patchTs({ allowGjs }));
  }
  registerParsedFile(options.filePath);

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

  // scopeManager is captured by the parser callback and used by visitors.
  // Both TS and JS paths create it inside the parser callback so it's
  // available when toTree invokes visitors during the splice traversal.
  let scopeManager = null;

  try {
    const result = toTree(code, {
      filePath,
      parser: useTS
        ? (_source, _parseResults, placeholderJS) => {
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
        : (_source, _parseResults, placeholderJS) => {
            // JS path: parse with oxc, create scope manager before visitors run
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

    if (!result.scopeManager) {
      result.scopeManager = scopeManager;
    }

    if (result.services?.program) {
      const programAllowJs = result.services.program.getCompilerOptions?.()?.allowJs;
      if (
        !allowGjsWasSet &&
        programAllowJs !== undefined &&
        actualAllowGjs !== undefined &&
        actualAllowGjs !== programAllowJs
      ) {
        // eslint-disable-next-line no-console
        console.warn(
          '[ember-eslint-parser] allowJs does not match the actual program. Consider setting allowGjs explicitly.\n' +
            `    Current: ${allowGjs}, Program: ${programAllowJs}`
        );
      }
      syncMtsGtsSourceFiles(result.services.program);
    }

    // Clean up internal properties before returning to ESLint
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
