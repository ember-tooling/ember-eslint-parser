import { createRequire } from 'node:module';
import { Preprocessor } from 'content-tag';
import {
  traverse as glimmerTraverse,
  preprocess as glimmerPreprocess,
  isKeyword as glimmerIsKeyword,
} from '@glimmer/syntax';
import { glimmerVisitorKeys, DocumentLines } from 'ember-estree';
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
  if (blockParamNodes.length === 0) return;
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

// ── Glint template processing helpers ─────────────────────────────────

function isAlphaNumeric(code) {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 95
  );
}

function isWhiteSpaceCode(code) {
  return code === 32 || code === 9 || code === 10 || code === 13;
}

function tokenize(template, doc, startOffset) {
  const tokens = [];
  let wordStart = -1;
  function pushToken(value, type, range) {
    const t = {
      type,
      value,
      range,
      start: range[0],
      end: range[1],
      loc: {
        start: { ...doc.offsetToPosition(range[0]), index: range[0] },
        end: { ...doc.offsetToPosition(range[1]), index: range[1] },
      },
    };
    tokens.push(t);
  }
  for (let i = 0; i < template.length; i++) {
    const code = template.charCodeAt(i);
    if (isAlphaNumeric(code)) {
      if (wordStart < 0) {
        wordStart = i;
      }
    } else {
      if (wordStart >= 0) {
        pushToken(template.slice(wordStart, i), 'word', [startOffset + wordStart, startOffset + i]);
        wordStart = -1;
      }
      if (!isWhiteSpaceCode(code)) {
        pushToken(template[i], 'Punctuator', [startOffset + i, startOffset + i + 1]);
      }
    }
  }
  if (wordStart >= 0) {
    pushToken(template.slice(wordStart), 'word', [
      startOffset + wordStart,
      startOffset + template.length,
    ]);
  }
  return tokens;
}

/**
 * Traverses a Glimmer AST, sets parent references, and categorizes nodes.
 * @param {object} ast
 * @return {{ allNodes: object[], comments: object[], textNodes: object[], emptyTextNodes: object[] }}
 */
function collectNodes(ast) {
  const allNodes = [];
  const comments = [];
  const textNodes = [];
  const emptyTextNodes = [];

  glimmerTraverse(ast, {
    All(node, path) {
      node.parent = path.parentNode;
      allNodes.push(node);
      if (node.type === 'CommentStatement' || node.type === 'MustacheCommentStatement') {
        comments.push(node);
      }
      if (node.type === 'TextNode') {
        node.value = node.chars;
        if (node.value.trim().length !== 0 || (node.parent && node.parent.type === 'AttrNode')) {
          textNodes.push(node);
        } else {
          emptyTextNodes.push(node);
        }
      }
    },
  });

  return { allNodes, comments, textNodes, emptyTextNodes };
}

/**
 * Removes nodes from their parent's children/body/parts arrays.
 * @param {object[]} nodes
 */
function removeFromParent(nodes) {
  for (const node of nodes) {
    const children =
      (node.parent && (node.parent.children || node.parent.body || node.parent.parts)) || [];
    const idx = children.indexOf(node);
    if (idx >= 0) {
      children.splice(idx, 1);
    }
  }
}

/**
 * Builds the final token stream by filtering out tokens covered by comments
 * or text nodes, then merging text nodes back in sorted order.
 * @param {object[]} rawTokens
 * @param {object[]} comments
 * @param {object[]} textNodes
 * @return {object[]}
 */
function buildTokenStream(rawTokens, comments, textNodes) {
  // Build sorted interval arrays for O(log n) exclusion checks
  const commentIntervals = comments.map((c) => c.range).sort((a, b) => a[0] - b[0]);
  const textNodeIntervals = textNodes.map((t) => t.range).sort((a, b) => a[0] - b[0]);

  /**
   * Binary-search: is the token's range fully covered by any interval in `intervals`?
   * Intervals must be sorted by start offset.
   * @param {number[]} tokenRange
   * @param {number[][]} intervals
   */
  function isCovered(tokenRange, intervals) {
    let lo = 0;
    let hi = intervals.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const iv = intervals[mid];
      if (iv[0] <= tokenRange[0] && iv[1] >= tokenRange[1]) {
        return true;
      }
      if (iv[0] > tokenRange[0]) {
        hi = mid - 1;
      } else {
        lo = mid + 1;
      }
    }
    return false;
  }

  // Single-pass filter: drop tokens covered by a comment or text node
  const filteredTokens = rawTokens.filter(
    (t) => !isCovered(t.range, commentIntervals) && !isCovered(t.range, textNodeIntervals)
  );

  // Merge text nodes (already sorted by position from the AST) into filteredTokens
  // using a single linear merge pass instead of repeated splice calls.
  const sortedTextNodes = [...textNodes].sort((a, b) => a.range[0] - b.range[0]);
  const result = [];
  let ti = 0;
  for (const token of filteredTokens) {
    while (ti < sortedTextNodes.length && sortedTextNodes[ti].range[0] < token.range[0]) {
      result.push(sortedTextNodes[ti++]);
    }
    result.push(token);
  }
  while (ti < sortedTextNodes.length) {
    result.push(sortedTextNodes[ti++]);
  }

  return result;
}

/**
 * Parses a Glimmer template and produces a processed AST ready for ESLint.
 * Shared between hbs-parser (standalone .hbs files) and gjs/gts parser (embedded templates).
 *
 * @param {object} options
 * @param {string} options.templateContent - The template string to parse with glimmer
 * @param {DocumentLines} options.codeLines - DocumentLines for the full source file
 * @param {[number, number]} options.templateRange - Range [start, end] for the Template root node
 * @param {string} [options.tokenSource] - String to tokenize (defaults to templateContent)
 * @return {{ ast: object, comments: object[] }}
 */
function processGlimmerTemplate({ templateContent, codeLines, templateRange, tokenSource }) {
  const offset = templateRange[0];
  const docLines = new DocumentLines(templateContent);

  /** Convert a Glimmer loc to a file-level [start, end] range */
  const toFileRange = (loc) => [
    offset + docLines.positionToOffset(loc.start),
    offset + docLines.positionToOffset(loc.end),
  ];
  /** Convert a file-level range to a file-level loc */
  const toFileLoc = (range) => ({
    start: codeLines.offsetToPosition(range[0]),
    end: codeLines.offsetToPosition(range[1]),
  });

  const ast = glimmerPreprocess(templateContent, { mode: 'codemod' });
  const { allNodes, comments, textNodes, emptyTextNodes } = collectNodes(ast);

  // Fix ranges, locs, and prefix types with "Glimmer"
  for (const n of allNodes) {
    if (n.type === 'PathExpression') {
      n.head.range = toFileRange(n.head.loc);
      n.head.loc = toFileLoc(n.head.range);
    }

    n.range = n.type === 'Template' ? [...templateRange] : toFileRange(n.loc);
    n.start = n.range[0];
    n.end = n.range[1];
    n.loc = toFileLoc(n.range);

    if (n.type === 'ElementNode') {
      n.name = n.tag;
      n.parts = [n.path.head].map((p) => {
        const range = toFileRange(p.loc);
        return {
          ...p,
          name: p.original,
          parent: n,
          type: 'GlimmerElementNodePart',
          range,
          loc: toFileLoc(range),
        };
      });
    }

    if ('blockParams' in n) {
      n.params = (n.params || []).map((p) => {
        const range = toFileRange(p.loc);
        return {
          ...p,
          type: 'BlockParam',
          name: p.original,
          parent: n,
          range,
          loc: toFileLoc(range),
        };
      });
    }

    // Nullify empty hashes before the type is renamed
    if (
      (n.type === 'MustacheStatement' ||
        n.type === 'BlockStatement' ||
        n.type === 'SubExpression') &&
      n.hash &&
      n.hash.pairs &&
      n.hash.pairs.length === 0
    ) {
      n.hash = null;
    }

    n.type = `Glimmer${n.type}`;
  }

  // Clean up AST structure
  removeFromParent(emptyTextNodes);
  removeFromParent(comments);
  for (const comment of comments) {
    comment.type = 'Block';
  }

  // Build final token stream
  ast.tokens = buildTokenStream(
    tokenize(tokenSource || templateContent, codeLines, offset),
    comments,
    textNodes
  );
  ast.contents = templateContent;

  return { ast, comments };
}

/**
 * Template infos already have character (UTF-16) offsets — no byte→char conversion needed.
 * @param {Array<{ range: [number, number] }>} glintTemplateInfos
 * @param {string} code - original source code
 */
export function preprocessGlimmerTemplatesFromCharOffsets(glintTemplateInfos, code) {
  const codeLines = new DocumentLines(code);
  const allComments = [];
  const templateInfos = glintTemplateInfos.map((r) => ({
    utf16Range: [...r.range],
  }));

  for (const tpl of templateInfos) {
    const template = code.slice(...tpl.utf16Range);
    const { ast, comments } = processGlimmerTemplate({
      templateContent: template,
      codeLines,
      templateRange: [...tpl.utf16Range],
    });
    ast.content = template;
    allComments.push(...comments);
    tpl.ast = ast;
  }

  return {
    templateVisitorKeys: glimmerVisitorKeys,
    templateInfos,
    comments: allComments,
  };
}

/**
 * traverses the AST and replaces the transformed template parts with the Glimmer
 * AST.
 * This also creates the scopes for the Glimmer Blocks and registers the block params
 * in the scope, and also any usages of variables in path expressions
 * this allows the basic eslint rules no-undef and no-unsused to work also for the
 * templates without needing any custom rules
 * @param result
 * @param preprocessedResult
 * @param visitorKeys
 */
export function convertAst(result, preprocessedResult, options) {
  const templateInfos = preprocessedResult.templateInfos;
  const matchByRangeOnly = options?.matchByRangeOnly || false;
  result.ast.comments.push(...preprocessedResult.comments);

  for (const ti of templateInfos) {
    const firstIdx = result.ast.tokens.findIndex((t) => t.range[0] === ti.utf16Range[0]);
    const lastIdx = result.ast.tokens.findIndex((t) => t.range[1] === ti.utf16Range[1]);
    if (firstIdx === -1 || lastIdx === -1) continue;
    result.ast.tokens.splice(firstIdx, lastIdx - firstIdx + 1, ...ti.ast.tokens);
  }

  // Build a Map keyed by range start for O(1) lookup during traversal
  const templateInfoByStart = new Map(templateInfos.map((t) => [t.utf16Range[0], t]));

  // eslint-disable-next-line complexity
  traverse(result.visitorKeys, result.ast, (path) => {
    const node = path.node;
    if (!node) return null;

    // Glint produces CallExpression for expression templates and StaticBlock for
    // class-member templates (vs TemplateLiteral from transformForLint).
    const typeMatches = matchByRangeOnly
      ? node.type === 'ExpressionStatement' ||
        node.type === 'CallExpression' ||
        node.type === 'StaticBlock' ||
        node.type === 'ExportDefaultDeclaration'
      : node.type === 'ExpressionStatement' ||
        node.type === 'StaticBlock' ||
        node.type === 'TemplateLiteral' ||
        node.type === 'ExportDefaultDeclaration';

    if (typeMatches) {
      let range = node.range;
      if (node.type === 'ExportDefaultDeclaration' && node.declaration) {
        range = [node.declaration.range[0], node.declaration.range[1]];
      }

      const template = templateInfoByStart.get(range[0]);
      if (
        !template ||
        (template.utf16Range[1] !== range[1] && template.utf16Range[1] !== range[1] + 1)
      ) {
        return null;
      }
      const ast = template.ast;
      Object.assign(node, ast);
    }

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
      registerElementNode(node, path, result.scopeManager);
    }
    if ('blockParams' in node && node.type?.startsWith('Glimmer')) {
      registerBlockParams(node, path, result.scopeManager, result.isTypescript);
    }
  });
}

/**
 * Scope registration for the HBS parser. Unlike the gjs/gts path, we do not
 * register references for free identifiers (`{{path}}`, `<Tag>`) — all
 * template locals are treated as runtime-defined, so no-undef stays quiet.
 * Only block params from `as |x|` constructs are declared.
 */
export function registerHBSScopes(result) {
  traverse(result.visitorKeys, result.ast, (path) => {
    const node = path.node;
    if (!node) return;
    if ('blockParams' in node && node.type.startsWith('Glimmer')) {
      registerBlockParams(node, path, result.scopeManager, false);
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

export { traverse };
