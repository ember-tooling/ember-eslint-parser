/**
 * Regression test for the sorted-by-range invariant on Program.comments.
 *
 * ESLint's SourceCode builds `tokensAndComments = sortedMerge(tokens, comments)`
 * and `createIndexMap(tokens, comments)` — both iterate comments and tokens
 * with a merge that assumes each array is already sorted by `range[0]`. Every
 * standard JS parser (espree, @babel/eslint-parser, @typescript-eslint/parser)
 * honors that invariant.
 *
 * When a .gts file has a JS block comment (slash-star style) interleaved between templates,
 * TS-parser comments are spread into `program.comments` first and Glimmer
 * template comments get appended — producing an array like
 * `[jsAt56, glimmerAt23]` whose order doesn't match range order. The
 * downstream effect is `sourceCode.getTokenBefore(glimmerComment)` /
 * `getTokenAfter(glimmerComment)` returning wrong tokens (or tokens from
 * entirely different template regions), because the `indexMap` keyed on
 * unsorted input points at the wrong token index.
 */

import { describe, expect, it } from 'vitest';
import { Linter } from 'eslint';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';

describe('program.comments sort order (ESLint tokensAndComments invariant)', () => {
  const mixedSource = [
    'const X = <template>',
    '  {{! glimmer comment at 22 }}',
    '</template>;',
    '/* js comment at 56 */',
    'const Y = 1;',
  ].join('\n');

  it('ast.comments is sorted by range[0]', () => {
    const { ast } = parseForESLint(mixedSource, {
      filePath: 't.gts',
      range: true,
      loc: true,
      comment: true,
      tokens: true,
    });
    const starts = (ast.comments || []).map((c) => c.range[0]);
    const sorted = [...starts].sort((a, b) => a - b);
    expect(starts).toEqual(sorted);
  });

  it('getTokenBefore / getTokenAfter on a Glimmer comment return source-adjacent tokens', () => {
    const linter = new Linter();
    linter.defineParser('p', { parseForESLint });
    const probes = [];
    linter.defineRule('probe', {
      create(context) {
        return {
          'Program:exit'() {
            const sc = context.sourceCode;
            for (const c of sc.getAllComments()) {
              if (c.value.includes('glimmer')) {
                probes.push({
                  commentRange: c.range,
                  before: sc.getTokenBefore(c)?.range ?? null,
                  after: sc.getTokenAfter(c)?.range ?? null,
                });
              }
            }
          },
        };
      },
    });
    linter.verify(
      mixedSource,
      {
        parser: 'p',
        parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
        rules: { probe: 'error' },
      },
      { filename: 't.gts' }
    );
    expect(probes).toHaveLength(1);
    const { commentRange, before, after } = probes[0];
    // Whatever the exact adjacent token ranges are, they must bracket the
    // comment — the token before must end at or before the comment's start,
    // and the token after must start at or after the comment's end.
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(before[1]).toBeLessThanOrEqual(commentRange[0]);
    expect(after[0]).toBeGreaterThanOrEqual(commentRange[1]);
  });
});
