import { createRequire } from 'node:module';
import { Preprocessor } from 'content-tag';
import { isKeyword as glimmerIsKeyword } from '@glimmer/syntax';
import { glimmerVisitorKeys } from 'ember-estree';
import { Reference, Scope, Variable, Definition } from 'eslint-scope';
import htmlTags from 'html-tags';
import svgTags from 'svg-tags';
import { mathmlTagNames } from 'mathml-tag-names';

const htmlTagsSet = new Set(htmlTags);
const svgTagsSet = new Set(svgTags);
const mathMLTagsSet = new Set(mathmlTagNames);

const require = createRequire(import.meta.url);

let TypescriptScope = null;
try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
  const scopeManagerPath = require.resolve('@typescript-eslint/scope-manager', {
    paths: [parserPath],
  });
  TypescriptScope = require(scopeManagerPath);
} catch {
  // not available
}

// ── Scope helpers ─────────────────────────────────────────────────────

function findParentScope(scopeManager, nodePath) {
  let scope = null;
  let path = nodePath;
  while (path) {
    scope = scopeManager.acquire(path.node, true);
    if (scope) {
      return scope;
    }
    path = path.parentPath;
  }
  return null;
}

function findVarInParentScopes(scopeManager, nodePath, name) {
  let defScope = null;
  let currentScope = null;
  let path = nodePath;
  while (path) {
    const s = scopeManager.acquire(path.node, true);
    if (s) {
      if (!currentScope) currentScope = s;
      if (s.set.has(name)) {
        defScope = s;
        break;
      }
    }
    path = path.parentPath;
  }
  if (!defScope) {
    return { scope: currentScope };
  }
  return { scope: currentScope, variable: defScope.set.get(name) };
}

function registerNodeInScope(node, scope, variable) {
  const ref = new Reference(node, scope, Reference.READ);
  if (variable) {
    variable.references.push(ref);
    ref.resolved = variable;
  } else {
    let s = scope;
    while (s.upper) {
      s = s.upper;
    }
    s.through.push(ref);
  }
  scope.references.push(ref);
}

function isUpperCase(char) {
  return char.toUpperCase() === char;
}

function registerBlockParams(node, path, scopeManager, isTypescript) {
  const blockParamNodes = node.blockParamNodes || [];
  const upperScope = findParentScope(scopeManager, path);
  const scope = isTypescript
    ? new TypescriptScope.BlockScope(scopeManager, upperScope, node)
    : new Scope(scopeManager, 'block', upperScope, node);
  const declaredVariables = scopeManager.declaredVariables || scopeManager.__declaredVariables;
  const vars = [];
  declaredVariables.set(node, vars);
  const virtualJSParentNode = {
    type: 'FunctionDeclaration',
    params: blockParamNodes,
    range: node.range,
    loc: node.loc,
    parent: path.parent,
  };
  for (const [i, b] of blockParamNodes.entries()) {
    const v = new Variable(b.name, scope);
    v.identifiers.push(b);
    scope.variables.push(v);
    scope.set.set(b.name, v);
    vars.push(v);

    const virtualJSNode = {
      type: 'Identifier',
      name: b.name,
      range: b.range,
      loc: b.loc,
      parent: virtualJSParentNode,
    };
    v.defs.push(new Definition('Parameter', virtualJSNode, node, node, i, 'Block Param'));
    v.defs.push(new Definition('Parameter', b, node, node, i, 'Block Param'));
  }
}

function registerPathExpression(node, path, scopeManager) {
  if (node.head.type !== 'VarHead') return;
  const name = node.head.name;
  if (glimmerIsKeyword(name)) return;
  const { scope, variable } = findVarInParentScopes(scopeManager, path, name) || {};
  if (scope) {
    node.head.parent = node;
    registerNodeInScope(node.head, scope, variable);
  }
}

function registerElementNode(node, path, scopeManager) {
  const n = node.parts[0];
  const { scope, variable } = findVarInParentScopes(scopeManager, path, n.name) || {};
  const ignore =
    n.name === 'this' ||
    n.name.startsWith(':') ||
    n.name.startsWith('@') ||
    !scope ||
    n.name.includes('-');

  const registerUndef =
    isUpperCase(n.name[0]) ||
    node.name.includes('.') ||
    (!htmlTagsSet.has(node.name) && !svgTagsSet.has(node.name) && !mathMLTagsSet.has(node.name));

  if (!ignore && (variable || registerUndef)) {
    registerNodeInScope(n, scope, variable);
  }
}

// ── Visitor builders ──────────────────────────────────────────────────

/**
 * Build Glimmer visitors for toTree that register scopes during traversal.
 * Uses a getter for scopeManager so it's available after the parser callback runs.
 * @param {function} getScopeManager - returns the scopeManager (may be null initially)
 * @param {boolean} isTypescript
 * @returns {object} visitors for toTree
 */
export function buildGlimmerVisitors(getScopeManager, isTypescript) {
  return {
    GlimmerPathExpression(node, path) {
      const sm = getScopeManager();
      if (sm) registerPathExpression(node, path, sm);
    },
    GlimmerElementNode(node, path) {
      const sm = getScopeManager();
      if (sm) registerElementNode(node, path, sm);
    },
    GlimmerBlockParams(node, path) {
      const sm = getScopeManager();
      if (sm) registerBlockParams(node, path, sm, isTypescript);
    },
  };
}

// ── registerGlimmerScopes (fallback for JS/oxc path) ──────────────────

function traverse(visitorKeys, node, visitor) {
  const allVisitorKeys = { ...visitorKeys, ...glimmerVisitorKeys };
  const queue = [];

  queue.push({
    node,
    parent: null,
    parentKey: null,
    parentPath: null,
    context: {},
  });

  while (queue.length > 0) {
    const currentPath = queue.pop();
    visitor(currentPath);
    if (!currentPath.node) continue;
    const keys = allVisitorKeys[currentPath.node.type];
    if (!keys) continue;
    for (const visitorKey of keys) {
      const child = currentPath.node[visitorKey];
      if (!child) {
        continue;
      } else if (Array.isArray(child)) {
        for (const item of child) {
          queue.push({
            node: item,
            parent: currentPath.node,
            context: currentPath.context,
            parentKey: visitorKey,
            parentPath: currentPath,
          });
        }
      } else {
        queue.push({
          node: child,
          parent: currentPath.node,
          context: currentPath.context,
          parentKey: visitorKey,
          parentPath: currentPath,
        });
      }
    }
  }
}

/**
 * Full AST traversal for scope registration — used as fallback for JS/oxc path.
 * For the TS path, toTree's visitor API handles this during splicing.
 */
export function registerGlimmerScopes(result) {
  // eslint-disable-next-line complexity
  traverse(result.visitorKeys, result.ast, (path) => {
    const node = path.node;
    if (!node) return;
    if (node.type === 'GlimmerPathExpression') {
      registerPathExpression(node, path, result.scopeManager);
    }
    if (node.type === 'GlimmerElementNode') {
      registerElementNode(node, path, result.scopeManager);
    }
    if ('blockParams' in node && node.type?.startsWith('Glimmer')) {
      registerBlockParams(node, path, result.scopeManager, result.isTypescript);
    }
  });
}

// ── transformForLint (used by ts-patch.js) ────────────────────────────

export const replaceRange = function replaceRange(s, start, end, substitute) {
  return s.slice(0, start) + substitute + s.slice(end);
};

const processor = new Preprocessor();

class EmberParserError extends Error {
  constructor(message, fileName, location) {
    super(message);
    this.location = location;
    this.fileName = fileName;
    Object.defineProperty(this, 'name', {
      configurable: true,
      enumerable: false,
      value: new.target.name,
    });
  }

  get index() {
    return this.location.start.offset;
  }

  get lineNumber() {
    return this.location.start.line;
  }

  get column() {
    return this.location.start.column;
  }
}

function createError(code, message, fileName, start, end = start) {
  return new EmberParserError(message, fileName, { end, start });
}

/**
 * Transform code for TypeScript virtual file system.
 * Replaces <template> regions with backtick/static-block placeholders.
 * Used by ts-patch.js for type-aware linting.
 */
export function transformForLint(code, fileName) {
  let result;
  try {
    result = processor.parse(code);
  } catch (e) {
    if (e.message.includes('Parse Error at')) {
      const [line, column] = e.message
        .split(':')
        .slice(-2)
        .map((x) => parseInt(x));
      throw createError(code, e.source_code, fileName, { line, column });
    }
    throw e;
  }

  // Build placeholder JS inline (same format as ember-estree's toPlaceholderJS)
  let jsCode = code;
  for (const tplInfo of [...result].reverse()) {
    const content = tplInfo.contents.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const start = tplInfo.range.startUtf16Codepoint;
    const end = tplInfo.range.endUtf16Codepoint;
    const tplLength = end - start;
    let replacement;
    if (tplInfo.type === 'class-member') {
      const spaces = tplLength - content.length - 10; // "static{`" + "`}" = 10
      replacement = `static{\`${content}${' '.repeat(Math.max(0, spaces))}\`}`;
    } else {
      const spaces = tplLength - content.length - 2; // "`" + "`" = 2
      replacement = `\`${content}${' '.repeat(Math.max(0, spaces))}\``;
    }
    jsCode = replaceRange(jsCode, start, end, replacement);
  }

  /* istanbul ignore next */
  if (jsCode.length !== code.length) {
    throw new Error('bad transform');
  }
  return {
    templateInfos: result,
    output: jsCode,
  };
}

export { traverse, glimmerVisitorKeys };
