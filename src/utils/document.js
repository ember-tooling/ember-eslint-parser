/**
 * @typedef {{ line: number; column: number }} Position
 */

// Helper class to convert line/column from and to offset
// taken and adapt from https://github.com/typed-ember/glint/blob/main/packages/core/src/language-server/util/position.ts
class DocumentLines {
  /**
   * @param {string} contents
   */
  constructor(contents) {
    this.lineStarts = computeLineStarts(contents);
  }

  /**
   * @param {Position} position
   * @return {number}
   */
  positionToOffset(position) {
    const { line, column } = position;
    return this.lineStarts[line - 1] + column;
  }

  /**
   *
   * @param {number} position
   * @return {Position}
   */
  offsetToPosition(position) {
    const lineStarts = this.lineStarts;
    let lo = 0;
    let hi = lineStarts.length - 1;
    // Upper-biased midpoint is required here: we want the *rightmost* line whose
    // start is ≤ position. With a lower-biased mid, when lo + 1 === hi and the
    // condition is true, mid === lo and lo never advances, causing an infinite loop.
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= position) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return { line: lo + 1, column: position - lineStarts[lo] };
  }
}

/**
 * @returns {number[]}
 * @param {string} text
 */
function computeLineStarts(text) {
  const result = [];
  let pos = 0;
  let lineStart = 0;
  while (pos < text.length) {
    const ch = text.charCodeAt(pos++);
    if (ch === 13 /* carriageReturn */) {
      if (text.charCodeAt(pos) === 10 /* lineFeed */) {
        pos++;
      }
      result.push(lineStart);
      lineStart = pos;
    } else if (
      ch === 10 /* lineFeed */ ||
      ch === 8232 /* lineSeparator */ ||
      ch === 8233 /* paragraphSeparator */
    ) {
      result.push(lineStart);
      lineStart = pos;
    }
  }
  result.push(lineStart);
  return result;
}

/* istanbul ignore next */
/**
 * @param {number} ch
 * @return {boolean}
 */
function isLineBreak(ch) {
  // ES5 7.3:
  // The ECMAScript line terminator characters are listed in Table 3.
  //     Table 3: Line Terminator Characters
  //     Code Unit Value     Name                    Formal Name
  //     \u000A              Line Feed               <LF>
  //     \u000D              Carriage Return         <CR>
  //     \u2028              Line separator          <LS>
  //     \u2029              Paragraph separator     <PS>
  // Only the characters in Table 3 are treated as line terminators. Other new line or line
  // breaking characters are treated as white space but not as line terminators.
  return (
    ch === 10 /* lineFeed */ ||
    ch === 13 /* carriageReturn */ ||
    ch === 8232 /* lineSeparator */ ||
    ch === 8233 /* paragraphSeparator */
  );
}

module.exports = DocumentLines;
module.exports.isLineBreak = isLineBreak;
