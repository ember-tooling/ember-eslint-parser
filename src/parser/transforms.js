const ContentTag = require('content-tag');
const glimmer = require('@glimmer/syntax');
const { visitorKeys: glimmerVisitorKeys } = glimmer;
const DocumentLines = require('../utils/document');
const { Reference, Scope, Variable, Definition } = require('eslint-scope');
const htmlTagsSet = new Set(require('html-tags').default);
const svgTagsSet = new Set(require('svg-tags'));
const mathMLTagsSet = new Set(require('mathml-tag-names').mathmlTagNames);

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

const BufferMap = new Map();

function getBuffer(str) {
  let buf = BufferMap.get(str);
  if (!buf) {
    buf = Buffer.from(str);
    BufferMap.set(str, buf);
  }
  return buf;
}

function sliceByteRange(str, a, b) {
  const buf = getBuffer(str);
  return buf.slice(a, b).toString();
}

function byteToCharIndex(str, byteOffset) {
  const buf = getBuffer(str);
  return buf.slice(0, byteOffset).toString().length;
}

function charToByteIndex(str, charOffset) {
  return getBuffer(str.slice(0, charOffset)).length;
}

function byteLength(str) {
  return getBuffer(str).length;
}

/**
 * finds the nearest node scope
 * @param scopeManager
 * @param nodePath
 * @return {*|null}
 */
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

/**
 * tries to find the variable names {name} in any parent scope
 * if the variable is not found it just returns the nearest scope,
 * so that it's usage can be registered.
 *
 * Also returns the nearest scope (equivalent to findParentScope) in one pass,
 * avoiding the redundant second traversal that findParentScope would perform.
 * @param scopeManager
 * @param nodePath
 * @param name
 * @return {{scope: null, variable: *}|{scope: (*|null)}}
 */
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

/**
 * registers a node variable usage in the scope.
 * @param node
 * @param scope
 * @param variable
 */
function registerNodeInScope(node, scope, variable) {
  const ref = new Reference(node, scope, Reference.READ);
  if (variable) {
    variable.references.push(ref);
    ref.resolved = variable;
  } else {
    // register missing variable in most upper scope.
    let s = scope;
    while (s.upper) {
      s = s.upper;
    }
    s.through.push(ref);
  }
  scope.references.push(ref);
}

/**
 * Builds the complete Glimmer visitor keys map with "Glimmer" prefix and
 * additional keys needed for traversal (blockParamNodes, parts, etc).
 * Result is cached since glimmerVisitorKeys is a constant.
 * @return {object}
 */
let _cachedGlimmerVisitorKeys = null;
function buildGlimmerVisitorKeys() {
  if (_cachedGlimmerVisitorKeys) return _cachedGlimmerVisitorKeys;
  const keys = {};
  for (const [k, v] of Object.entries(glimmerVisitorKeys)) {
    keys[`Glimmer${k}`] = [...v];
  }
  if (!keys.GlimmerElementNode.includes('blockParamNodes')) {
    keys.GlimmerElementNode.push('blockParamNodes', 'parts');
  }
  keys.GlimmerProgram = ['body', 'blockParamNodes'];
  keys.GlimmerTemplate = ['body'];
  _cachedGlimmerVisitorKeys = keys;
  return keys;
}

/**
 * traverses all nodes using the {visitorKeys} calling the callback function, visitor
 * @param visitorKeys
 * @param node
 * @param visitor
 */
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

    const visitorKeys = allVisitorKeys[currentPath.node.type];
    if (!visitorKeys) {
      continue;
    }

    for (const visitorKey of visitorKeys) {
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

function isAlphaNumeric(code) {
  return !(
    !(code > 47 && code < 58) && // numeric (0-9)
    !(code > 64 && code < 91) && // upper alpha (A-Z)
    !(code > 96 && code < 123)
  );
}

function isWhiteSpaceCode(code) {
  return (
    code === 32 /* space */ ||
    code === 9 /* tab */ ||
    code === 13 /* carriageReturn */ ||
    code === 10 /* lineFeed */ ||
    code === 11 /* verticalTab */
  );
}

/**
 * simple tokenizer for templates, just splits it up into words and punctuators
 * @param template {string}
 * @param startOffset {number}
 * @param doc {DocumentLines}
 * @return {Token[]}
 */
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

  glimmer.traverse(ast, {
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

  const ast = glimmer.preprocess(templateContent, { mode: 'codemod' });
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
 * Preprocesses the template info, parsing the template content to Glimmer AST,
 * fixing the offsets and locations of all nodes
 * also calculates the block params locations & ranges
 * and adding it to the info
 * @param info
 * @param code
 * @return {{templateVisitorKeys: {}, comments: *[], templateInfos: {templateRange: *, range: *, replacedRange: *}[]}}
 */
module.exports.preprocessGlimmerTemplates = function preprocessGlimmerTemplates(info, code) {
  const templateInfos = info.templateInfos.map((r) => ({
    range: [r.contentRange.startByte, r.contentRange.endByte],
    templateRange: [r.range.startByte, r.range.endByte],
    utf16Range: [byteToCharIndex(code, r.range.startByte), byteToCharIndex(code, r.range.endByte)],
  }));
  const codeLines = new DocumentLines(code);
  const allComments = [];

  for (const tpl of templateInfos) {
    const range = tpl.utf16Range;
    const template = code.slice(...range);

    const { ast, comments } = processGlimmerTemplate({
      templateContent: template,
      codeLines,
      templateRange: [...tpl.utf16Range],
      tokenSource: sliceByteRange(code, ...tpl.templateRange),
    });

    ast.content = template;
    allComments.push(...comments);
    tpl.ast = ast;
  }

  return {
    templateVisitorKeys: buildGlimmerVisitorKeys(),
    templateInfos,
    comments: allComments,
  };
};

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
module.exports.convertAst = function convertAst(result, preprocessedResult, visitorKeys) {
  const templateInfos = preprocessedResult.templateInfos;
  let counter = 0;
  result.ast.comments.push(...preprocessedResult.comments);

  for (const ti of templateInfos) {
    const firstIdx = result.ast.tokens.findIndex((t) => t.range[0] === ti.utf16Range[0]);
    const lastIdx = result.ast.tokens.findIndex((t) => t.range[1] === ti.utf16Range[1]);
    result.ast.tokens.splice(firstIdx, lastIdx - firstIdx + 1, ...ti.ast.tokens);
  }

  // Build a Map keyed by range start for O(1) lookup during traversal
  const templateInfoByStart = new Map(templateInfos.map((t) => [t.utf16Range[0], t]));

  // eslint-disable-next-line complexity
  traverse(visitorKeys, result.ast, (path) => {
    const node = path.node;
    if (!node) return null;

    if (
      node.type === 'ExpressionStatement' ||
      node.type === 'StaticBlock' ||
      node.type === 'TemplateLiteral' ||
      node.type === 'ExportDefaultDeclaration'
    ) {
      let range = node.range;
      if (node.type === 'ExportDefaultDeclaration') {
        range = [node.declaration.range[0], node.declaration.range[1]];
      }

      const template = templateInfoByStart.get(range[0]);
      if (
        !template ||
        (template.utf16Range[1] !== range[1] && template.utf16Range[1] !== range[1] + 1)
      ) {
        return null;
      }
      counter++;
      const ast = template.ast;
      Object.assign(node, ast);
    }

    if (node.type === 'GlimmerPathExpression' && node.head.type === 'VarHead') {
      const name = node.head.name;
      if (glimmer.isKeyword(name)) {
        return null;
      }
      const { scope, variable } = findVarInParentScopes(result.scopeManager, path, name) || {};
      if (scope) {
        node.head.parent = node;
        registerNodeInScope(node.head, scope, variable);
      }
    }
    if (node.type === 'GlimmerElementNode') {
      // always reference first part of tag name, this also has the advantage
      // that errors regarding this tag will only mark the tag name instead of
      // the whole tag + children
      const n = node.parts[0];
      const { scope, variable } = findVarInParentScopes(result.scopeManager, path, n.name) || {};
      /*
      register a node in scope if we found a variable
      we ignore named-blocks and args as we know that it doesn't reference anything in current scope
      we also ignore `this`
      if we do not find a variable we register it with a missing variable if
        * it starts with upper case, it should be a component with a reference
        * it includes a dot, it's a path which should have a reference
        * it's NOT a standard html, svg or mathml tag, it should have a referenced variable
      */
      const ignore =
        // Local instance access
        n.name === 'this' ||
        // named block
        n.name.startsWith(':') ||
        // argument
        n.name.startsWith('@') ||
        // defined locally
        !scope ||
        // custom-elements are allowed to be used even if they don't exist
        // and are undefined
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
        params: node.params,
        range: node.range,
        loc: node.loc,
        parent: path.parent,
      };
      for (const [i, b] of node.params.entries()) {
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

  if (counter !== templateInfos.length) {
    throw new Error('failed to process all templates');
  }
};

const replaceRange = function replaceRange(s, start, end, substitute) {
  return sliceByteRange(s, 0, start) + substitute + sliceByteRange(s, end);
};
module.exports.replaceRange = replaceRange;
module.exports.charToByteIndex = charToByteIndex;

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

  // For old version of ESLint https://github.com/typescript-eslint/typescript-eslint/pull/6556#discussion_r1123237311
  get index() {
    return this.location.start.offset;
  }

  // https://github.com/eslint/eslint/blob/b09a512107249a4eb19ef5a37b0bd672266eafdb/lib/linter/linter.js#L853
  get lineNumber() {
    return this.location.start.line;
  }

  // https://github.com/eslint/eslint/blob/b09a512107249a4eb19ef5a37b0bd672266eafdb/lib/linter/linter.js#L854
  get column() {
    return this.location.start.column;
  }
}

function createError(code, message, fileName, start, end = start) {
  return new EmberParserError(message, fileName, { end, start });
}

module.exports.transformForLint = function transformForLint(code, fileName) {
  let jsCode = code;
  /**
   *
   * @type {{
   *   type: 'expression' | 'class-member';
   *   tagName: 'template';
   *   contents: string;
   *   range: {
   *     startByte: number;
   *     endByte: number;
   *     startChar: number;
   *     endChar: number;
   *     startUtf16Codepoint: number;
   *     endUtf16Codepoint: number;
   *   };
   *   contentRange: {
   *     startByte: number;
   *     endByte: number;
   *     startChar: number;
   *     endChar: number;
   *     startUtf16Codepoint: number;
   *     endUtf16Codepoint: number;
   *   };
   *   startRange: {
   *     startByte: number;
   *     endByte: number;
   *     startChar: number;
   *     endChar: number;
   *     startUtf16Codepoint: number;
   *     endUtf16Codepoint: number;
   *   };
   *   endRange: {
   *     startByte: number;
   *     endByte: number;
   *     startChar: number;
   *     endChar: number;
   *     startUtf16Codepoint: number;
   *     endUtf16Codepoint: number;
   *   };
   * }[]}
   */
  let result = null;
  try {
    result = processor.parse(code);
  } catch (e) {
    // Parse Error at <anon>:1:19: 1:19
    if (e.message.includes('Parse Error at')) {
      const [line, column] = e.message
        .split(':')
        .slice(-2)
        .map((x) => parseInt(x));
      // e.source_code has actually usable info, e.g × Expected ',', got 'string literal (, '')'
      //     ╭─[9:1]
      //   9 │
      //  10 │ console.log(test'');
      //     ·                 ──
      //     ╰────
      throw createError(code, e.source_code, fileName, { line, column });
    }
    throw e;
  }
  for (const tplInfo of result.reverse()) {
    const content = tplInfo.contents.replace(/`/g, '\\`').replace(/\$/g, '\\$');
    if (tplInfo.type === 'class-member') {
      const tplLength = tplInfo.range.endByte - tplInfo.range.startByte;
      const spaces = tplLength - byteLength(content) - 'static{`'.length - '`}'.length;
      const total = content + ' '.repeat(spaces);
      const replacementCode = `static{\`${total}\`}`;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startByte,
        tplInfo.range.endByte,
        replacementCode
      );
    } else {
      const tplLength = tplInfo.range.endByte - tplInfo.range.startByte;
      const spaces = tplLength - byteLength(content) - '`'.length - '`'.length;
      const total = content + ' '.repeat(spaces);
      const replacementCode = `\`${total}\``;
      jsCode = replaceRange(
        jsCode,
        tplInfo.range.startByte,
        tplInfo.range.endByte,
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
};

module.exports.traverse = traverse;
module.exports.tokenize = tokenize;
module.exports.processGlimmerTemplate = processGlimmerTemplate;
module.exports.buildGlimmerVisitorKeys = buildGlimmerVisitorKeys;
