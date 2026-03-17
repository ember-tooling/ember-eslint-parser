import { createRequire } from 'node:module';
import ContentTag from 'content-tag';
import { isKeyword as glimmerIsKeyword } from '@glimmer/syntax';
import { buildGlimmerVisitorKeys } from 'ember-estree';
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

// ── Scope helpers ──

function findParentScope(scopeManager, nodePath) {
  let path = nodePath;
  while (path) {
    const scope = scopeManager.acquire(path.node, true);
    if (scope) return scope;
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
  if (!defScope) return { scope: currentScope };
  return { scope: currentScope, variable: defScope.set.get(name) };
}

function registerNodeInScope(node, scope, variable) {
  const ref = new Reference(node, scope, Reference.READ);
  if (variable) {
    variable.references.push(ref);
    ref.resolved = variable;
  } else {
    let s = scope;
    while (s.upper) s = s.upper;
    s.through.push(ref);
  }
  scope.references.push(ref);
}

function isUpperCase(char) {
  return char.toUpperCase() === char;
}

// ── Glimmer scope registration (called by visitor during toTree walk) ──

/**
 * Registers Glimmer template variable references and block param scopes
 * in the ESLint scope manager.
 */
export function registerGlimmerScopes(path, scopeManager, isTypescript) {
  const node = path.node;
  if (!node) return;

  if (node.type === 'GlimmerPathExpression' && node.head?.type === 'VarHead') {
    const name = node.head.name;
    if (glimmerIsKeyword(name)) return;
    const { scope, variable } = findVarInParentScopes(scopeManager, path, name) || {};
    if (scope) {
      node.head.parent = node;
      registerNodeInScope(node.head, scope, variable);
    }
  }

  if (node.type === 'GlimmerElementNode') {
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

  if ('blockParams' in node) {
    const upperScope = findParentScope(scopeManager, path);
    const scope = isTypescript
      ? new TypescriptScope.BlockScope(scopeManager, upperScope, node)
      : new Scope(scopeManager, 'block', upperScope, node);
    const declaredVariables = scopeManager.declaredVariables || scopeManager.__declaredVariables;
    const vars = [];
    declaredVariables.set(node, vars);
    const blockParamNodes = node.blockParamNodes || [];
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
}

// ── Utilities for ts-patch.js and tests ──

export const replaceRange = function replaceRange(s, start, end, substitute) {
  return s.slice(0, start) + substitute + s.slice(end);
};

const _processor = new ContentTag.Preprocessor();

/**
 * Creates placeholder JS for TypeScript project services (ts-patch.js).
 * Uses content-tag to extract templates and replace with backtick placeholders.
 */
export function transformForLint(code, fileName) {
  let jsCode = code;
  let result = null;
  try {
    result = _processor.parse(code);
  } catch (e) {
    if (e.message.includes('Parse Error at')) {
      const [line, column] = e.message.split(':').slice(-2).map((x) => parseInt(x));
      const err = new Error(e.source_code || e.message);
      err.lineNumber = line;
      err.column = column;
      err.fileName = fileName;
      throw err;
    }
    throw e;
  }
  for (const tplInfo of result.reverse()) {
    const content = tplInfo.contents.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const tplLength = tplInfo.range.endUtf16Codepoint - tplInfo.range.startUtf16Codepoint;
    if (tplInfo.type === 'class-member') {
      const spaces = tplLength - content.length - 'static{`'.length - '`}'.length;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startUtf16Codepoint,
        tplInfo.range.endUtf16Codepoint,
        `static{\`${content + ' '.repeat(spaces)}\`}`
      );
    } else {
      const spaces = tplLength - content.length - '`'.length - '`'.length;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startUtf16Codepoint,
        tplInfo.range.endUtf16Codepoint,
        `\`${content + ' '.repeat(spaces)}\``
      );
    }
  }
  if (jsCode.length !== code.length) {
    throw new Error('bad transform');
  }
  return { templateInfos: result, output: jsCode };
}

/**
 * Traverses all nodes using visitorKeys, calling visitor for each.
 * Used by tests for AST inspection.
 */
export function traverse(visitorKeys, node, visitor) {
  const allVisitorKeys = { ...visitorKeys, ...buildGlimmerVisitorKeys() };
  const queue = [{ node, parent: null, parentKey: null, parentPath: null, context: {} }];

  while (queue.length > 0) {
    const currentPath = queue.pop();
    visitor(currentPath);
    if (!currentPath.node) continue;
    const keys = allVisitorKeys[currentPath.node.type];
    if (!keys) continue;
    for (const key of keys) {
      const child = currentPath.node[key];
      if (!child) continue;
      if (Array.isArray(child)) {
        for (const item of child) {
          queue.push({
            node: item,
            parent: currentPath.node,
            context: currentPath.context,
            parentKey: key,
            parentPath: currentPath,
          });
        }
      } else {
        queue.push({
          node: child,
          parent: currentPath.node,
          context: currentPath.context,
          parentKey: key,
          parentPath: currentPath,
        });
      }
    }
  }
}
