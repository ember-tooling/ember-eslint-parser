import { createRequire } from 'node:module';
import ContentTag from 'content-tag';
import { isKeyword as glimmerIsKeyword } from '@glimmer/syntax';
import {
  processGlimmerTemplate,
  buildGlimmerVisitorKeys,
  DocumentLines,
  traverse,
} from 'ember-estree';
import { Reference, Scope, Variable, Definition } from 'eslint-scope';
import htmlTags from 'html-tags';
import svgTags from 'svg-tags';
import { mathmlTagNames } from 'mathml-tag-names';

export { traverse, buildGlimmerVisitorKeys };

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

function isUpperCase(char) {
  return char.toUpperCase() === char;
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
export function preprocessGlimmerTemplates(info, code) {
  const templateInfos = info.templateInfos.map((r) => ({
    utf16Range: [r.range.startUtf16Codepoint, r.range.endUtf16Codepoint],
  }));
  const codeLines = new DocumentLines(code);
  const allComments = [];

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
    templateVisitorKeys: buildGlimmerVisitorKeys(),
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
export function convertAst(result, preprocessedResult, visitorKeys) {
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
    return null;
  });

  if (counter !== templateInfos.length) {
    throw new Error('failed to process all templates');
  }
}

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

export function transformForLint(code, fileName) {
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
