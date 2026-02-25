const glimmer = require('@glimmer/syntax');
const eslintScope = require('eslint-scope');
const DocumentLines = require('../utils/document');
const { visitorKeys: glimmerVisitorKeys } = require('@glimmer/syntax');
const { tokenize } = require('./transforms');

/**
 * implements https://eslint.org/docs/latest/extend/custom-parsers
 * for Handlebars (.hbs) template files.
 *
 * The entire file is treated as a Glimmer template.
 * All locals not defined in the template are assumed to be defined
 * (no no-undef errors for template identifiers).
 */

/**
 * @type {import('eslint').ParserModule}
 */
module.exports = {
  meta: {
    name: 'ember-eslint-parser/hbs',
    version: '*',
  },

  parseForESLint(code, options) {
    const filePath = (options && options.filePath) || '<hbs>';

    const codeLines = new DocumentLines(code);

    // Parse the HBS template with glimmer
    let ast;
    try {
      ast = glimmer.preprocess(code, { mode: 'codemod' });
    } catch (e) {
      // Transform glimmer parse error to ESLint-compatible error
      const loc = e.location || (e.hash && e.hash.loc);
      if (loc && loc.start) {
        const err = Object.assign(new SyntaxError(e.message), {
          lineNumber: loc.start.line,
          column: loc.start.column,
          index: codeLines.positionToOffset(loc.start),
          fileName: filePath,
        });
        throw err;
      }
      throw e;
    }

    const comments = [];
    const textNodes = [];
    const emptyTextNodes = [];
    const allNodes = [];

    // First pass: collect nodes and set parent references
    glimmer.traverse(ast, {
      All(node, path) {
        const n = node;
        n.parent = path.parentNode;
        allNodes.push(node);
        if (node.type === 'CommentStatement' || node.type === 'MustacheCommentStatement') {
          comments.push(node);
        }
        if (node.type === 'TextNode') {
          n.value = node.chars;
          if (n.value.trim().length !== 0 || (n.parent && n.parent.type === 'AttrNode')) {
            textNodes.push(node);
          } else {
            emptyTextNodes.push(node);
          }
        }
      },
    });

    // Second pass: fix up ranges/locs and prefix types with "Glimmer"
    for (const n of allNodes) {
      if (n.type === 'PathExpression') {
        n.head.range = [
          codeLines.positionToOffset(n.head.loc.start),
          codeLines.positionToOffset(n.head.loc.end),
        ];
        n.head.loc = {
          start: codeLines.offsetToPosition(n.head.range[0]),
          end: codeLines.offsetToPosition(n.head.range[1]),
        };
      }

      n.range =
        n.type === 'Template'
          ? [0, code.length]
          : [codeLines.positionToOffset(n.loc.start), codeLines.positionToOffset(n.loc.end)];
      n.start = n.range[0];
      n.end = n.range[1];
      n.loc = {
        start: codeLines.offsetToPosition(n.range[0]),
        end: codeLines.offsetToPosition(n.range[1]),
      };

      if (n.type === 'ElementNode') {
        n.name = n.tag;
        n.parts = [n.path.head].map((p) => {
          const range = [
            codeLines.positionToOffset(p.loc.start),
            codeLines.positionToOffset(p.loc.end),
          ];
          const loc = {
            start: codeLines.offsetToPosition(range[0]),
            end: codeLines.offsetToPosition(range[1]),
          };
          return {
            ...p,
            name: p.original,
            parent: n,
            type: 'GlimmerElementNodePart',
            range,
            loc,
          };
        });
      }

      if ('blockParams' in n) {
        n.params = (n.params || []).map((p) => {
          const range = [
            codeLines.positionToOffset(p.loc.start),
            codeLines.positionToOffset(p.loc.end),
          ];
          const loc = {
            start: codeLines.offsetToPosition(range[0]),
            end: codeLines.offsetToPosition(range[1]),
          };
          return {
            ...p,
            type: 'BlockParam',
            name: p.original,
            parent: n,
            range,
            loc,
          };
        });
      }

      n.type = `Glimmer${n.type}`;
    }

    // Remove empty text nodes from their parents
    for (const node of emptyTextNodes) {
      const children =
        (node.parent && (node.parent.children || node.parent.body || node.parent.parts)) || [];
      const idx = children.indexOf(node);
      if (idx >= 0) {
        children.splice(idx, 1);
      }
    }

    // Remove comment nodes from parent and mark as Block comments
    for (const comment of comments) {
      const parentBody = comment.parent && (comment.parent.body || comment.parent.children);
      if (parentBody) {
        const idx = parentBody.indexOf(comment);
        if (idx >= 0) {
          parentBody.splice(idx, 1);
        }
      }
      comment.type = 'Block';
    }

    // Cleanup empty hashes (BlockStatement, MustacheStatement, SubExpression)
    for (const n of allNodes) {
      if (
        ['GlimmerMustacheStatement', 'GlimmerBlockStatement', 'GlimmerSubExpression'].includes(
          n.type
        )
      ) {
        if (n.hash && n.hash.pairs && n.hash.pairs.length === 0) {
          n.hash = null;
        }
      }
    }

    // Generate tokens for the whole template
    const tokens = tokenize(code, codeLines, 0);

    // Filter out tokens that fall within comments
    let processedTokens = tokens.filter(
      (t) => !comments.some((c) => c.range[0] <= t.range[0] && c.range[1] >= t.range[1])
    );

    // Replace text-node ranges with the text nodes themselves
    processedTokens = processedTokens.filter(
      (t) => !textNodes.some((c) => c.range[0] <= t.range[0] && c.range[1] >= t.range[1])
    );

    // Merge text nodes back in sorted order
    const sortedTextNodes = [...textNodes];
    let currentTextNode = sortedTextNodes.pop();
    for (let i = processedTokens.length - 1; i >= 0; i--) {
      const t = processedTokens[i];
      while (currentTextNode && t.range[0] < currentTextNode.range[0]) {
        processedTokens.splice(i + 1, 0, currentTextNode);
        currentTextNode = sortedTextNodes.pop();
      }
    }
    if (currentTextNode) {
      processedTokens.unshift(currentTextNode);
    }

    // The GlimmerTemplate node is now the root
    const templateNode = ast; // already transformed to GlimmerTemplate
    templateNode.tokens = processedTokens;
    templateNode.comments = comments;
    templateNode.contents = code;

    // Wrap in a synthetic Program node (required by ESLint)
    const program = {
      type: 'Program',
      body: [templateNode],
      tokens: processedTokens,
      comments,
      range: [0, code.length],
      start: 0,
      end: code.length,
      loc: {
        start: { line: 1, column: 0 },
        end: codeLines.offsetToPosition(code.length),
      },
    };

    // Build visitor keys: Program + all Glimmer node types prefixed
    const visitorKeys = {
      Program: ['body'],
    };
    for (const [k, v] of Object.entries(glimmerVisitorKeys)) {
      visitorKeys[`Glimmer${k}`] = [...v];
    }
    // GlimmerElementNode needs parts and blockParamNodes
    if (!visitorKeys.GlimmerElementNode.includes('blockParamNodes')) {
      visitorKeys.GlimmerElementNode.push('blockParamNodes', 'parts');
    }
    // GlimmerTemplate uses body
    visitorKeys.GlimmerTemplate = ['body'];

    // Create an empty scope manager.
    // For HBS, all locals are assumed to be defined at runtime,
    // so we don't track variable references (no no-undef errors).
    const scopeManager = eslintScope.analyze(
      {
        type: 'Program',
        body: [],
        range: [0, code.length],
        loc: program.loc,
      },
      { range: true }
    );

    return {
      ast: program,
      scopeManager,
      visitorKeys,
      services: {},
    };
  },
};
