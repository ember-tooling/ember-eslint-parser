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

// ── AST traversal ─────────────────────────────────────────────────────

function traverse(visitorKeys, node, visitor) {
  const allVisitorKeys = { ...visitorKeys, ...buildGlimmerVisitorKeys() };
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
    if (!keys) {
      continue;
    }

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

function isUpperCase(char) {
  return char.toUpperCase() === char;
}

// ── Glimmer scope registration ────────────────────────────────────────

/**
 * Walks the AST and registers Glimmer-specific scopes:
 * - Block scopes for blockParams ({{#each ... as |item|}})
 * - Variable references for path expressions ({{foo}})
 * - Variable references for element tag names (<MyComponent />)
 *
 * This is the ESLint-specific layer on top of ember-estree's AST.
 * @param result - The parseForESLint result with ast, scopeManager, visitorKeys, isTypescript
 */
export function registerGlimmerScopes(result) {
  // eslint-disable-next-line complexity
  traverse(result.visitorKeys, result.ast, (path) => {
    const node = path.node;
    if (!node) return null;

    if (node.type === 'GlimmerPathExpression' && node.head.type === 'VarHead') {
      const name = node.head.name;
      if (glimmerIsKeyword(name)) {
        return null;
      }
      const { scope, variable } = findVarInParentScopes(result.scopeManager, path, name) || {};
      if (scope) {
        node.head.parent = node;
        registerNodeInScope(node.head, scope, variable);
      }
    }
    if (node.type === 'GlimmerElementNode') {
      const n = node.parts[0];
      const { scope, variable } = findVarInParentScopes(result.scopeManager, path, n.name) || {};

      const ignore =
        n.name === 'this' ||
        n.name.startsWith(':') ||
        n.name.startsWith('@') ||
        !scope ||
        n.name.includes('-');

      const registerUndef =
        isUpperCase(n.name[0]) ||
        node.name.includes('.') ||
        (!htmlTagsSet.has(node.name) &&
          !svgTagsSet.has(node.name) &&
          !mathMLTagsSet.has(node.name));

      if (!ignore && (variable || registerUndef)) {
        registerNodeInScope(n, scope, variable);
      }
    }

    if ('blockParams' in node) {
      const blockParamNodes = node.blockParamNodes || [];
      const upperScope = findParentScope(result.scopeManager, path);
      const scope = result.isTypescript
        ? new TypescriptScope.BlockScope(result.scopeManager, upperScope, node)
        : new Scope(result.scopeManager, 'block', upperScope, node);
      const declaredVariables =
        result.scopeManager.declaredVariables || result.scopeManager.__declaredVariables;
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
    return null;
  });
}

// ── transformForLint (used by ts-patch.js) ────────────────────────────

export const replaceRange = function replaceRange(s, start, end, substitute) {
  return s.slice(0, start) + substitute + s.slice(end);
};

const processor = new ContentTag.Preprocessor();

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
 * Replaces <template> regions with backtick expressions that TS can parse.
 * Used by ts-patch.js for type-aware linting.
 */
export function transformForLint(code, fileName) {
  let jsCode = code;
  let result = null;
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
  for (const tplInfo of result.reverse()) {
    const content = tplInfo.contents.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    if (tplInfo.type === 'class-member') {
      const tplLength = tplInfo.range.endUtf16Codepoint - tplInfo.range.startUtf16Codepoint;
      const spaces = tplLength - content.length - 'static{`'.length - '`}'.length;
      const total = content + ' '.repeat(spaces);
      const replacementCode = `static{\`${total}\`}`;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startUtf16Codepoint,
        tplInfo.range.endUtf16Codepoint,
        replacementCode
      );
    } else {
      const tplLength = tplInfo.range.endUtf16Codepoint - tplInfo.range.startUtf16Codepoint;
      const spaces = tplLength - content.length - '`'.length - '`'.length;
      const total = content + ' '.repeat(spaces);
      const replacementCode = `\`${total}\``;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startUtf16Codepoint,
        tplInfo.range.endUtf16Codepoint,
        replacementCode
      );
    }
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

export { traverse, buildGlimmerVisitorKeys };
