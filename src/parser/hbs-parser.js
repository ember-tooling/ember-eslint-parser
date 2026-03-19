import * as eslintScope from 'eslint-scope';
import { toTree, glimmerVisitorKeys, DocumentLines } from 'ember-estree';

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

  // Use the Template node's loc.end for the Program's end position
  // (avoids creating a duplicate DocumentLines just for this)
  const endLoc = templateNode.loc?.end || { line: 1, column: code.length };

  // Wrap in a synthetic Program node (required by ESLint)
  const program = {
    type: 'Program',
    body: [templateNode],
    tokens: templateNode.tokens,
    comments,
    range: [0, code.length],
    start: 0,
    end: code.length,
    loc: {
      start: { line: 1, column: 0 },
      end: endLoc,
    },
  };

  // Build visitor keys: Program + all Glimmer node types
  const visitorKeys = hbsVisitorKeys;

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
}

export default { meta, parseForESLint };
