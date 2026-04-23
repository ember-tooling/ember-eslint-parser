import { createRequire } from 'node:module';
import tsconfigUtils from '@typescript-eslint/tsconfig-utils';
import { registerParsedFile } from '../preprocessor/noop.js';
import { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser } from './ts-patch.js';
import { buildGlimmerVisitors } from './transforms.js';
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

  // Both paths create scopeManager inside the parser callback so it's
  // available when toTree invokes the visitor factory — no second pass.
  let scopeManager = null;
  const glimmerComments = [];
  // Snapshot of range+type → TS-node mappings captured before zimmerframe's
  // walk. zimmerframe's apply_mutations creates new ESTree node objects for any
  // parent whose child was mutated (ClassDeclaration, ExportNamedDeclaration,
  // Program). Those new objects are absent from the TS parser's WeakMap-based
  // esTreeNodeToTSNodeMap, so TypeScript-aware rules crash. We restore the
  // mapping for every new node by keying on range+type after the walk.
  const prewalkTSMappings = new Map(); // "type,start,end" → tsNode

  try {
    const result = toTree(code, {
      filePath,
      tokens: true,
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
            // Snapshot the ESTree→TSNode mapping for every node in the
            // original AST before zimmerframe's walk replaces some of them.
            const esMap = tsResult.services?.esTreeNodeToTSNodeMap;
            if (esMap) {
              const snapSeen = new WeakSet();
              (function snap(node) {
                if (!node || typeof node !== 'object' || snapSeen.has(node)) return;
                if (Array.isArray(node)) {
                  node.forEach(snap);
                  return;
                }
                if (
                  typeof node.type !== 'string' ||
                  !Array.isArray(node.range) ||
                  typeof node.range[0] !== 'number'
                )
                  return;
                snapSeen.add(node);
                const tsNode = esMap.get(node);
                if (tsNode)
                  prewalkTSMappings.set(`${node.type},${node.range[0]},${node.range[1]}`, tsNode);
                for (const key of Object.keys(node)) {
                  if (key === 'parent' || key === 'tokens' || key === 'comments') continue;
                  snap(node[key]);
                }
              })(tsResult.ast);
            }
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
      // Factory form: scopeManager is set by the parser callback before this runs.
      // Returns null when unavailable so ember-estree skips the zimmerframe walk.
      // Also collect Glimmer comment nodes for surfacing in program.comments.
      visitors: (_outerAst) => {
        const v = buildGlimmerVisitors(scopeManager, useTS);
        if (!v) return null;
        return {
          ...v,
          GlimmerMustacheCommentStatement(node) {
            glimmerComments.push(node);
          },
          GlimmerCommentStatement(node) {
            glimmerComments.push(node);
          },
        };
      },
    });

    if (!result.scopeManager) result.scopeManager = scopeManager;

    // zimmerframe replaces parent nodes (ClassDeclaration, ExportNamedDeclaration,
    // VariableDeclaration, Program) with new objects when a child is mutated.
    // The scope manager's WeakMap holds references to the ORIGINAL nodes, so
    // ESLint's context.getScope() fails on the new nodes and falls through to
    // the global scope — crashing rules (e.g. no-setter-return) that access
    // `scope.upper.type` on the global scope's null upper.
    // Fix by building a range+type → node map of the new AST and re-registering
    // every scope's block on the new node + patching orphan def.node.parent.
    const parentByKey = new Map();
    const nodeByKey = new Map();
    if (result.scopeManager) {
      const astRoot = result.ast?.program ?? result.ast;
      if (astRoot) {
        // Only traverse nodes that look like ESTree (have a string type and an
        // array range). Skipping TypeScript-internal properties (heritageClauses,
        // implements, etc.) avoids traversing into TS-internal structures that
        // can form cycles or have unexpected shapes.
        const seen = new WeakSet();
        (function collectParents(node, parent) {
          if (!node || typeof node !== 'object' || seen.has(node)) return;
          if (Array.isArray(node)) {
            node.forEach((c) => collectParents(c, parent));
            return;
          }
          // Only process ESTree-shaped nodes (string type + [start,end] range)
          if (
            typeof node.type !== 'string' ||
            !Array.isArray(node.range) ||
            typeof node.range[0] !== 'number'
          ) {
            return;
          }
          seen.add(node);
          const key = `${node.type},${node.range[0]},${node.range[1]}`;
          parentByKey.set(key, parent);
          nodeByKey.set(key, node);
          for (const k of Object.keys(node)) {
            if (k === 'parent' || k === 'tokens' || k === 'comments') continue;
            collectParents(node[k], node);
          }
        })(astRoot, null);

        // Re-point scope.block to the new AST node and re-register the
        // WeakMap entries (both eslint-scope's `__nodeToScope` and
        // typescript-eslint's `nodeToScope`). Without this, ESLint can't
        // find a scope for a function/arrow/class replaced by zimmerframe
        // and falls back to the global scope.
        const sm = result.scopeManager;
        const nodeToScope = sm.__nodeToScope ?? sm.nodeToScope;
        const declaredVars = sm.__declaredVariables ?? sm.declaredVariables;
        for (const scope of sm.scopes || []) {
          const oldBlock = scope.block;
          if (!oldBlock || !oldBlock.range) continue;
          const key = `${oldBlock.type},${oldBlock.range[0]},${oldBlock.range[1]}`;
          const newBlock = nodeByKey.get(key);
          if (!newBlock || newBlock === oldBlock) continue;
          if (nodeToScope) {
            const entry = nodeToScope.get(oldBlock);
            if (entry) nodeToScope.set(newBlock, entry);
          }
          if (declaredVars?.has?.(oldBlock)) {
            declaredVars.set(newBlock, declaredVars.get(oldBlock));
          }
          scope.block = newBlock;
        }

        (function fixScope(scope) {
          for (const variable of scope.variables) {
            for (const def of variable.defs) {
              if (def.node && !def.node.parent && def.node.range) {
                const key = `${def.node.type},${def.node.range[0]},${def.node.range[1]}`;
                const newParent = parentByKey.get(key);
                if (newParent) def.node.parent = newParent;
              }
            }
          }
          for (const child of scope.childScopes) fixScope(child);
        })(result.scopeManager.globalScope ?? result.scopeManager.scopes?.[0]);
      }
    }

    // Restore TS service map entries for nodes replaced by zimmerframe.
    // zimmerframe's apply_mutations creates new ESTree node objects for any
    // parent whose child was mutated. The TS parser's WeakMap-based
    // esTreeNodeToTSNodeMap only knows the ORIGINAL nodes — TypeScript-aware
    // rules crash when esMap.get(newNode) → undefined.
    //
    // For every new ESTree node, if a pre-walk mapping exists with the same
    // type+range, copy it forward. Also map GlimmerTemplate → placeholder
    // tsNode so getTypeAtLocation returns `string` (not the error intrinsic).
    if (prewalkTSMappings.size > 0 && result.services?.esTreeNodeToTSNodeMap) {
      const esMap = result.services.esTreeNodeToTSNodeMap;
      const PLACEHOLDER_TYPES = [
        'TemplateLiteral',
        'StaticBlock',
        'ExpressionStatement',
        'ExportDefaultDeclaration',
      ];
      for (const [key, node] of nodeByKey) {
        if (esMap.has(node)) continue;
        if (node.type === 'GlimmerTemplate') {
          for (const pt of PLACEHOLDER_TYPES) {
            const tsNode = prewalkTSMappings.get(`${pt},${node.range[0]},${node.range[1]}`);
            if (tsNode) {
              esMap.set(node, tsNode);
              break;
            }
          }
          continue;
        }
        const tsNode = prewalkTSMappings.get(key);
        if (tsNode) esMap.set(node, tsNode);
      }
    }

    // Surface Glimmer template comments in program.comments as type:'Block'
    // so ESLint's inline-config scanner and plugin rules recognise them.
    if (glimmerComments.length > 0) {
      const programNode = result.ast?.program ?? result.ast;
      if (programNode) {
        programNode.comments = [
          ...(programNode.comments || []),
          ...glimmerComments.map((c) => ({
            type: 'Block',
            value: c.value,
            range: c.range,
            loc: c.loc,
          })),
        ];
      }
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
      // e.source_code is the full diagnostic block. Strip ANSI escape codes
      // (content-tag colours output in TTY environments, which breaks
      // grep-based test:check assertions) and trim leading/trailing blank
      // lines so consumers see a clean message.
      // eslint-disable-next-line no-control-regex
      const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');
      const errorText = e.source_code ? stripAnsi(e.source_code).trim() : e.message;
      const err = new Error(errorText);
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
