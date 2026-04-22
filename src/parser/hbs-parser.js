import * as eslintScope from 'eslint-scope';
import { toTree, glimmerVisitorKeys, DocumentLines } from 'ember-estree';
import { registerHBSScopes } from './transforms.js';

// Constant: Program + all Glimmer node types. Computed once at module load.
const hbsVisitorKeys = { Program: ['body'], ...glimmerVisitorKeys };

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
export const meta = {
  name: 'ember-eslint-parser/hbs',
  version: '*',
};

export function parseForESLint(code, options) {
  const filePath = (options && options.filePath) || '<hbs>';

  let result;
  try {
    result = toTree(code, { templateOnly: true });
  } catch (e) {
    // Transform glimmer parse error to ESLint-compatible error
    const loc = e.location || (e.hash && e.hash.loc);
    if (loc && loc.start) {
      const codeLines = new DocumentLines(code);
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

  const { ast: templateNode, comments } = result;

  // ember-estree 0.4.3+ keeps Glimmer comment nodes in the template body with
  // semantic Glimmer types. For ESLint consumers we restore the pre-0.4.3
  // contract: expose Block-typed entries in Program.comments (so inline-config
  // directives fire and rules that filter on `type === 'Block'` keep working)
  // and remove the originals from the body (so rules like core `indent`, which
  // call getLastToken on body children, don't crash on tokenless comments).
  const eslintComments = [];
  const toRemove = [];
  for (const c of comments) {
    if (c.type === 'GlimmerCommentStatement' || c.type === 'GlimmerMustacheCommentStatement') {
      eslintComments.push({
        type: 'Block',
        value: c.value,
        range: c.range,
        start: c.start,
        end: c.end,
        loc: c.loc,
      });
      toRemove.push(c);
    } else {
      eslintComments.push(c);
    }
  }
  removeFromParent(toRemove);
  eslintComments.sort((a, b) => a.range[0] - b.range[0]);

  // Use the Template node's loc.end for the Program's end position
  // (avoids creating a duplicate DocumentLines just for this)
  const endLoc = templateNode.loc?.end || { line: 1, column: code.length };

  // Wrap in a synthetic Program node (required by ESLint)
  const program = {
    type: 'Program',
    body: [templateNode],
    tokens: templateNode.tokens,
    comments: eslintComments,
    range: [0, code.length],
    start: 0,
    end: code.length,
    loc: {
      start: { line: 1, column: 0 },
      end: endLoc,
    },
  };

  // Analyze a stub Program then rebind the resulting global scope to the real
  // Program. Analyzing the real Program directly causes infinite recursion in
  // esrecurse because Glimmer subtree nodes carry parent back-links.
  const stubProgram = {
    type: 'Program',
    body: [],
    range: [0, code.length],
    loc: program.loc,
  };
  const scopeManager = eslintScope.analyze(stubProgram, { range: true });
  const globalScope = scopeManager.acquire(stubProgram);
  globalScope.block = program;
  scopeManager.__nodeToScope.delete(stubProgram);
  scopeManager.__nodeToScope.set(program, [globalScope]);

  registerHBSScopes({ ast: program, scopeManager, visitorKeys: hbsVisitorKeys });

  return {
    ast: program,
    scopeManager,
    visitorKeys: hbsVisitorKeys,
    services: {},
  };
}

function removeFromParent(nodes) {
  for (const node of nodes) {
    const parent = node.parent;
    if (!parent) continue;
    const children = parent.children || parent.body || parent.parts;
    if (!children) continue;
    const idx = children.indexOf(node);
    if (idx >= 0) children.splice(idx, 1);
  }
}

export default { meta, parseForESLint };
