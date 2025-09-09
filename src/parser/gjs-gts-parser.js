const tsconfigUtils = require('@typescript-eslint/tsconfig-utils');
const babelParser = require('@babel/eslint-parser');
const { registerParsedFile } = require('../preprocessor/noop');
const {
  patchTs,
  replaceExtensions,
  syncMtsGtsSourceFiles,
  typescriptParser,
} = require('./ts-patch');
const { transformForLint, preprocessGlimmerTemplates, convertAst } = require('./transforms');

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
 * @param {string} property - The compiler option property to extract
 * @returns {boolean|undefined}
 */
function parseCompilerOptionFromTsconfig(tsconfigPath, rootDir, property) {
  try {
    const parserPath = require.resolve('@typescript-eslint/parser');
    // eslint-disable-next-line n/no-unpublished-require
    const tsPath = require.resolve('typescript', { paths: [parserPath] });
    const ts = require(tsPath);
    const parsed = tsconfigUtils.getParsedConfigFile(ts, tsconfigPath, rootDir);
    return parsed?.options?.[property];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      `[ember-eslint-parser] Failed to parse tsconfig for ${property}:`,
      tsconfigPath,
      e
    );
    return undefined;
  }
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

  const filtered = allowJsValues.filter((val) => typeof val !== 'undefined');
  if (filtered.length > 0) {
    const uniqueValues = [...new Set(filtered)];
    if (uniqueValues.length > 1) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ember-eslint-parser] Conflicting allowJs values in programs. Defaulting allowGjs to false.`
      );
      return false;
    } else {
      return uniqueValues[0];
    }
  }
  return null;
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
 * Generic function to resolve compiler options based on priority: programs > projectService > project/tsconfig
 * @param {object} options - Parser options
 * @param {string} property - The compiler option property to resolve (e.g., 'allowJs', 'allowArbitraryExtensions')
 * @param {Function} [programsExtractor] - Function to extract the property from programs (optional)
 * @returns {boolean} - The resolved value
 */
function getCompilerOption(options, property, programsExtractor) {
  // Check programs first (if extractor provided)
  if (programsExtractor) {
    const programsValue = programsExtractor(options.programs);
    if (programsValue !== null) return programsValue;
  }

  const rootDir = options.tsconfigRootDir || process.cwd();

  const projectServiceTsconfigPath = getProjectServiceTsconfigPath(options.projectService);
  if (projectServiceTsconfigPath) {
    const result = parseCompilerOptionFromTsconfig(projectServiceTsconfigPath, rootDir, property);
    if (result !== undefined) return result;
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
    for (const tsconfigPath of tsconfigPaths) {
      const result = parseCompilerOptionFromTsconfig(tsconfigPath, rootDir, property);
      if (result !== undefined) return result;
    }
  }

  return false; // Default to false if not found
}

/**
 * Returns the resolved allowJs value based on priority: programs > projectService > project/tsconfig
 */
function getAllowJs(options) {
  return getCompilerOption(options, 'allowJs', getAllowJsFromPrograms);
}

/**
 * Returns the resolved allowArbitraryExtensions value based on priority: projectService > project/tsconfig
 */
function getAllowArbitraryExtensions(options) {
  return getCompilerOption(options, 'allowArbitraryExtensions');
}

/**
 * @type {import('eslint').ParserModule}
 */
module.exports = {
  meta: {
    name: 'ember-eslint-parser',
    version: '*',
  },

  parseForESLint(code, options) {
    const allowGjsWasSet = options.allowGjs !== undefined;
    const allowGjs = allowGjsWasSet ? options.allowGjs : getAllowJs(options);
    const allowArbitraryExtensionsWasSet = options.allowArbitraryExtensions !== undefined;
    const allowArbitraryExtensions = allowArbitraryExtensionsWasSet
      ? options.allowArbitraryExtensions
      : getAllowArbitraryExtensions(options);
    let actualAllowGjs, actualAllowArbitraryExtensions;
    // Only patch TypeScript if we actually need it.
    if (options.programs || options.projectService || options.project) {
      ({ allowGjs: actualAllowGjs, allowArbitraryExtensions: actualAllowArbitraryExtensions } =
        patchTs({
          allowGjs,
          allowArbitraryExtensions,
        }));

      if (actualAllowGjs !== allowGjs) {
        console.warn(
          `ember-eslint-parser: allowGjs changed from ${allowGjs} to ${actualAllowGjs} due to TypeScript configuration`
        );
      }

      if (actualAllowArbitraryExtensions !== allowArbitraryExtensions) {
        console.warn(
          `ember-eslint-parser: allowArbitraryExtensions changed from ${allowArbitraryExtensions} to ${actualAllowArbitraryExtensions} due to TypeScript configuration`
        );
      }
    }
    registerParsedFile(options.filePath);
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
    if (options.project) {
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
        // Compare allowJs with the actual program's compiler options
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

        // Compare allowArbitraryExtensions with the actual program's compiler options
        const programAllowArbitraryExtensions =
          result.services.program.getCompilerOptions?.()?.allowArbitraryExtensions;
        if (
          !allowArbitraryExtensionsWasSet &&
          programAllowArbitraryExtensions !== undefined &&
          actualAllowArbitraryExtensions !== undefined &&
          actualAllowArbitraryExtensions !== programAllowArbitraryExtensions
        ) {
          // eslint-disable-next-line no-console
          console.warn(
            '[ember-eslint-parser] allowArbitraryExtensions does not match the actual program. Consider setting allowArbitraryExtensions explicitly.\n' +
              `    Current: ${allowArbitraryExtensions}, Program: ${programAllowArbitraryExtensions}`
          );
        }

        syncMtsGtsSourceFiles(result.services.program);
      }
      return { ...result, visitorKeys };
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
};
