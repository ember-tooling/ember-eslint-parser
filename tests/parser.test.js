import { beforeAll, describe, expect, it } from 'vitest';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';
import { traverse } from '../src/parser/transforms.js';
import { SourceCode } from 'eslint';

describe('transform', () => {
  let text, result;
  beforeAll(() => {
    text = `
    import { ExternalLink, Link, service } from 'limber-ui';

const ReportIssue = <template>
  If the tutorial navigated you here,
  <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
  ❤️
</template>;

const CurrentPath = <template>
  {{#let (service "docs") as |docs|}}
    <code>{{docs.currentPath}}</code>
  {{/let}}
</template>;

const BackToStart = <template>
  You may also try going
  <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
</template>;

export const NotFound = <template>
  Prose for the current tutorial, <CurrentPath />, could not be found.

  Please check the URL and try again,
  or navigate to a different tutorial chapter.

  <br /><br />
  <ReportIssue />

  <br /><br /><br>
  <BackToStart />
</template>;
    `;

    result = parseForESLint(text, {
      filePath: 'example.gts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });
  });

  it('all tokens are correct', () => {
    expect(
      result.ast.tokens.map((t) => ({
        value: t.value,
        loc: t.loc,
        range: t.range,
      }))
    ).toMatchInlineSnapshot(`
      [
        {
          "loc": {
            "end": {
              "column": 10,
              "line": 2,
            },
            "start": {
              "column": 4,
              "line": 2,
            },
          },
          "range": [
            5,
            11,
          ],
          "value": "import",
        },
        {
          "loc": {
            "end": {
              "column": 12,
              "line": 2,
            },
            "start": {
              "column": 11,
              "line": 2,
            },
          },
          "range": [
            12,
            13,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 25,
              "line": 2,
            },
            "start": {
              "column": 13,
              "line": 2,
            },
          },
          "range": [
            14,
            26,
          ],
          "value": "ExternalLink",
        },
        {
          "loc": {
            "end": {
              "column": 26,
              "line": 2,
            },
            "start": {
              "column": 25,
              "line": 2,
            },
          },
          "range": [
            26,
            27,
          ],
          "value": ",",
        },
        {
          "loc": {
            "end": {
              "column": 31,
              "line": 2,
            },
            "start": {
              "column": 27,
              "line": 2,
            },
          },
          "range": [
            28,
            32,
          ],
          "value": "Link",
        },
        {
          "loc": {
            "end": {
              "column": 32,
              "line": 2,
            },
            "start": {
              "column": 31,
              "line": 2,
            },
          },
          "range": [
            32,
            33,
          ],
          "value": ",",
        },
        {
          "loc": {
            "end": {
              "column": 40,
              "line": 2,
            },
            "start": {
              "column": 33,
              "line": 2,
            },
          },
          "range": [
            34,
            41,
          ],
          "value": "service",
        },
        {
          "loc": {
            "end": {
              "column": 42,
              "line": 2,
            },
            "start": {
              "column": 41,
              "line": 2,
            },
          },
          "range": [
            42,
            43,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 47,
              "line": 2,
            },
            "start": {
              "column": 43,
              "line": 2,
            },
          },
          "range": [
            44,
            48,
          ],
          "value": "from",
        },
        {
          "loc": {
            "end": {
              "column": 59,
              "line": 2,
            },
            "start": {
              "column": 48,
              "line": 2,
            },
          },
          "range": [
            49,
            60,
          ],
          "value": "'limber-ui'",
        },
        {
          "loc": {
            "end": {
              "column": 60,
              "line": 2,
            },
            "start": {
              "column": 59,
              "line": 2,
            },
          },
          "range": [
            60,
            61,
          ],
          "value": ";",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "line": 4,
            },
            "start": {
              "column": 0,
              "line": 4,
            },
          },
          "range": [
            63,
            68,
          ],
          "value": "const",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "line": 4,
            },
            "start": {
              "column": 6,
              "line": 4,
            },
          },
          "range": [
            69,
            80,
          ],
          "value": "ReportIssue",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 4,
            },
            "start": {
              "column": 18,
              "line": 4,
            },
          },
          "range": [
            81,
            82,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 21,
              "index": 84,
              "line": 4,
            },
            "start": {
              "column": 20,
              "index": 83,
              "line": 4,
            },
          },
          "range": [
            83,
            84,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 29,
              "index": 92,
              "line": 4,
            },
            "start": {
              "column": 21,
              "index": 84,
              "line": 4,
            },
          },
          "range": [
            84,
            92,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 30,
              "index": 93,
              "line": 4,
            },
            "start": {
              "column": 29,
              "index": 92,
              "line": 4,
            },
          },
          "range": [
            92,
            93,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "line": 6,
            },
            "start": {
              "column": 30,
              "line": 4,
            },
          },
          "range": [
            93,
            134,
          ],
          "value": "
        If the tutorial navigated you here,
        ",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 135,
              "line": 6,
            },
            "start": {
              "column": 2,
              "index": 134,
              "line": 6,
            },
          },
          "range": [
            134,
            135,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 15,
              "index": 147,
              "line": 6,
            },
            "start": {
              "column": 3,
              "index": 135,
              "line": 6,
            },
          },
          "range": [
            135,
            147,
          ],
          "value": "ExternalLink",
        },
        {
          "loc": {
            "end": {
              "column": 20,
              "index": 152,
              "line": 6,
            },
            "start": {
              "column": 16,
              "index": 148,
              "line": 6,
            },
          },
          "range": [
            148,
            152,
          ],
          "value": "href",
        },
        {
          "loc": {
            "end": {
              "column": 21,
              "index": 153,
              "line": 6,
            },
            "start": {
              "column": 20,
              "index": 152,
              "line": 6,
            },
          },
          "range": [
            152,
            153,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 69,
              "line": 6,
            },
            "start": {
              "column": 21,
              "line": 6,
            },
          },
          "range": [
            153,
            201,
          ],
          "value": "https://github.com/NullVoxPopuli/limber/issues",
        },
        {
          "loc": {
            "end": {
              "column": 70,
              "index": 202,
              "line": 6,
            },
            "start": {
              "column": 69,
              "index": 201,
              "line": 6,
            },
          },
          "range": [
            201,
            202,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 93,
              "line": 6,
            },
            "start": {
              "column": 70,
              "line": 6,
            },
          },
          "range": [
            202,
            225,
          ],
          "value": "please report the issue",
        },
        {
          "loc": {
            "end": {
              "column": 94,
              "index": 226,
              "line": 6,
            },
            "start": {
              "column": 93,
              "index": 225,
              "line": 6,
            },
          },
          "range": [
            225,
            226,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 95,
              "index": 227,
              "line": 6,
            },
            "start": {
              "column": 94,
              "index": 226,
              "line": 6,
            },
          },
          "range": [
            226,
            227,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 107,
              "index": 239,
              "line": 6,
            },
            "start": {
              "column": 95,
              "index": 227,
              "line": 6,
            },
          },
          "range": [
            227,
            239,
          ],
          "value": "ExternalLink",
        },
        {
          "loc": {
            "end": {
              "column": 108,
              "index": 240,
              "line": 6,
            },
            "start": {
              "column": 107,
              "index": 239,
              "line": 6,
            },
          },
          "range": [
            239,
            240,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 0,
              "line": 8,
            },
            "start": {
              "column": 108,
              "line": 6,
            },
          },
          "range": [
            240,
            247,
          ],
          "value": ".
        ❤️
      ",
        },
        {
          "loc": {
            "end": {
              "column": 1,
              "index": 248,
              "line": 8,
            },
            "start": {
              "column": 0,
              "index": 247,
              "line": 8,
            },
          },
          "range": [
            247,
            248,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "index": 249,
              "line": 8,
            },
            "start": {
              "column": 1,
              "index": 248,
              "line": 8,
            },
          },
          "range": [
            248,
            249,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 257,
              "line": 8,
            },
            "start": {
              "column": 2,
              "index": 249,
              "line": 8,
            },
          },
          "range": [
            249,
            257,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 258,
              "line": 8,
            },
            "start": {
              "column": 10,
              "index": 257,
              "line": 8,
            },
          },
          "range": [
            257,
            258,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 8,
            },
            "start": {
              "column": 18,
              "line": 8,
            },
          },
          "range": [
            258,
            259,
          ],
          "value": ";",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "line": 10,
            },
            "start": {
              "column": 0,
              "line": 10,
            },
          },
          "range": [
            261,
            266,
          ],
          "value": "const",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "line": 10,
            },
            "start": {
              "column": 6,
              "line": 10,
            },
          },
          "range": [
            267,
            278,
          ],
          "value": "CurrentPath",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 10,
            },
            "start": {
              "column": 18,
              "line": 10,
            },
          },
          "range": [
            279,
            280,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 21,
              "index": 282,
              "line": 10,
            },
            "start": {
              "column": 20,
              "index": 281,
              "line": 10,
            },
          },
          "range": [
            281,
            282,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 29,
              "index": 290,
              "line": 10,
            },
            "start": {
              "column": 21,
              "index": 282,
              "line": 10,
            },
          },
          "range": [
            282,
            290,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 30,
              "index": 291,
              "line": 10,
            },
            "start": {
              "column": 29,
              "index": 290,
              "line": 10,
            },
          },
          "range": [
            290,
            291,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 295,
              "line": 11,
            },
            "start": {
              "column": 2,
              "index": 294,
              "line": 11,
            },
          },
          "range": [
            294,
            295,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 4,
              "index": 296,
              "line": 11,
            },
            "start": {
              "column": 3,
              "index": 295,
              "line": 11,
            },
          },
          "range": [
            295,
            296,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "index": 297,
              "line": 11,
            },
            "start": {
              "column": 4,
              "index": 296,
              "line": 11,
            },
          },
          "range": [
            296,
            297,
          ],
          "value": "#",
        },
        {
          "loc": {
            "end": {
              "column": 8,
              "index": 300,
              "line": 11,
            },
            "start": {
              "column": 5,
              "index": 297,
              "line": 11,
            },
          },
          "range": [
            297,
            300,
          ],
          "value": "let",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 302,
              "line": 11,
            },
            "start": {
              "column": 9,
              "index": 301,
              "line": 11,
            },
          },
          "range": [
            301,
            302,
          ],
          "value": "(",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "index": 309,
              "line": 11,
            },
            "start": {
              "column": 10,
              "index": 302,
              "line": 11,
            },
          },
          "range": [
            302,
            309,
          ],
          "value": "service",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "index": 311,
              "line": 11,
            },
            "start": {
              "column": 18,
              "index": 310,
              "line": 11,
            },
          },
          "range": [
            310,
            311,
          ],
          "value": """,
        },
        {
          "loc": {
            "end": {
              "column": 23,
              "index": 315,
              "line": 11,
            },
            "start": {
              "column": 19,
              "index": 311,
              "line": 11,
            },
          },
          "range": [
            311,
            315,
          ],
          "value": "docs",
        },
        {
          "loc": {
            "end": {
              "column": 24,
              "index": 316,
              "line": 11,
            },
            "start": {
              "column": 23,
              "index": 315,
              "line": 11,
            },
          },
          "range": [
            315,
            316,
          ],
          "value": """,
        },
        {
          "loc": {
            "end": {
              "column": 25,
              "index": 317,
              "line": 11,
            },
            "start": {
              "column": 24,
              "index": 316,
              "line": 11,
            },
          },
          "range": [
            316,
            317,
          ],
          "value": ")",
        },
        {
          "loc": {
            "end": {
              "column": 28,
              "index": 320,
              "line": 11,
            },
            "start": {
              "column": 26,
              "index": 318,
              "line": 11,
            },
          },
          "range": [
            318,
            320,
          ],
          "value": "as",
        },
        {
          "loc": {
            "end": {
              "column": 30,
              "index": 322,
              "line": 11,
            },
            "start": {
              "column": 29,
              "index": 321,
              "line": 11,
            },
          },
          "range": [
            321,
            322,
          ],
          "value": "|",
        },
        {
          "loc": {
            "end": {
              "column": 34,
              "index": 326,
              "line": 11,
            },
            "start": {
              "column": 30,
              "index": 322,
              "line": 11,
            },
          },
          "range": [
            322,
            326,
          ],
          "value": "docs",
        },
        {
          "loc": {
            "end": {
              "column": 35,
              "index": 327,
              "line": 11,
            },
            "start": {
              "column": 34,
              "index": 326,
              "line": 11,
            },
          },
          "range": [
            326,
            327,
          ],
          "value": "|",
        },
        {
          "loc": {
            "end": {
              "column": 36,
              "index": 328,
              "line": 11,
            },
            "start": {
              "column": 35,
              "index": 327,
              "line": 11,
            },
          },
          "range": [
            327,
            328,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 37,
              "index": 329,
              "line": 11,
            },
            "start": {
              "column": 36,
              "index": 328,
              "line": 11,
            },
          },
          "range": [
            328,
            329,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "index": 335,
              "line": 12,
            },
            "start": {
              "column": 4,
              "index": 334,
              "line": 12,
            },
          },
          "range": [
            334,
            335,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 9,
              "index": 339,
              "line": 12,
            },
            "start": {
              "column": 5,
              "index": 335,
              "line": 12,
            },
          },
          "range": [
            335,
            339,
          ],
          "value": "code",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 340,
              "line": 12,
            },
            "start": {
              "column": 9,
              "index": 339,
              "line": 12,
            },
          },
          "range": [
            339,
            340,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 341,
              "line": 12,
            },
            "start": {
              "column": 10,
              "index": 340,
              "line": 12,
            },
          },
          "range": [
            340,
            341,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 12,
              "index": 342,
              "line": 12,
            },
            "start": {
              "column": 11,
              "index": 341,
              "line": 12,
            },
          },
          "range": [
            341,
            342,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 16,
              "index": 346,
              "line": 12,
            },
            "start": {
              "column": 12,
              "index": 342,
              "line": 12,
            },
          },
          "range": [
            342,
            346,
          ],
          "value": "docs",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "index": 347,
              "line": 12,
            },
            "start": {
              "column": 16,
              "index": 346,
              "line": 12,
            },
          },
          "range": [
            346,
            347,
          ],
          "value": ".",
        },
        {
          "loc": {
            "end": {
              "column": 28,
              "index": 358,
              "line": 12,
            },
            "start": {
              "column": 17,
              "index": 347,
              "line": 12,
            },
          },
          "range": [
            347,
            358,
          ],
          "value": "currentPath",
        },
        {
          "loc": {
            "end": {
              "column": 29,
              "index": 359,
              "line": 12,
            },
            "start": {
              "column": 28,
              "index": 358,
              "line": 12,
            },
          },
          "range": [
            358,
            359,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 30,
              "index": 360,
              "line": 12,
            },
            "start": {
              "column": 29,
              "index": 359,
              "line": 12,
            },
          },
          "range": [
            359,
            360,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 31,
              "index": 361,
              "line": 12,
            },
            "start": {
              "column": 30,
              "index": 360,
              "line": 12,
            },
          },
          "range": [
            360,
            361,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 32,
              "index": 362,
              "line": 12,
            },
            "start": {
              "column": 31,
              "index": 361,
              "line": 12,
            },
          },
          "range": [
            361,
            362,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 36,
              "index": 366,
              "line": 12,
            },
            "start": {
              "column": 32,
              "index": 362,
              "line": 12,
            },
          },
          "range": [
            362,
            366,
          ],
          "value": "code",
        },
        {
          "loc": {
            "end": {
              "column": 37,
              "index": 367,
              "line": 12,
            },
            "start": {
              "column": 36,
              "index": 366,
              "line": 12,
            },
          },
          "range": [
            366,
            367,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 371,
              "line": 13,
            },
            "start": {
              "column": 2,
              "index": 370,
              "line": 13,
            },
          },
          "range": [
            370,
            371,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 4,
              "index": 372,
              "line": 13,
            },
            "start": {
              "column": 3,
              "index": 371,
              "line": 13,
            },
          },
          "range": [
            371,
            372,
          ],
          "value": "{",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "index": 373,
              "line": 13,
            },
            "start": {
              "column": 4,
              "index": 372,
              "line": 13,
            },
          },
          "range": [
            372,
            373,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 8,
              "index": 376,
              "line": 13,
            },
            "start": {
              "column": 5,
              "index": 373,
              "line": 13,
            },
          },
          "range": [
            373,
            376,
          ],
          "value": "let",
        },
        {
          "loc": {
            "end": {
              "column": 9,
              "index": 377,
              "line": 13,
            },
            "start": {
              "column": 8,
              "index": 376,
              "line": 13,
            },
          },
          "range": [
            376,
            377,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 378,
              "line": 13,
            },
            "start": {
              "column": 9,
              "index": 377,
              "line": 13,
            },
          },
          "range": [
            377,
            378,
          ],
          "value": "}",
        },
        {
          "loc": {
            "end": {
              "column": 1,
              "index": 380,
              "line": 14,
            },
            "start": {
              "column": 0,
              "index": 379,
              "line": 14,
            },
          },
          "range": [
            379,
            380,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "index": 381,
              "line": 14,
            },
            "start": {
              "column": 1,
              "index": 380,
              "line": 14,
            },
          },
          "range": [
            380,
            381,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 389,
              "line": 14,
            },
            "start": {
              "column": 2,
              "index": 381,
              "line": 14,
            },
          },
          "range": [
            381,
            389,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 390,
              "line": 14,
            },
            "start": {
              "column": 10,
              "index": 389,
              "line": 14,
            },
          },
          "range": [
            389,
            390,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 14,
            },
            "start": {
              "column": 18,
              "line": 14,
            },
          },
          "range": [
            390,
            391,
          ],
          "value": ";",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "line": 16,
            },
            "start": {
              "column": 0,
              "line": 16,
            },
          },
          "range": [
            393,
            398,
          ],
          "value": "const",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "line": 16,
            },
            "start": {
              "column": 6,
              "line": 16,
            },
          },
          "range": [
            399,
            410,
          ],
          "value": "BackToStart",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 16,
            },
            "start": {
              "column": 18,
              "line": 16,
            },
          },
          "range": [
            411,
            412,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 21,
              "index": 414,
              "line": 16,
            },
            "start": {
              "column": 20,
              "index": 413,
              "line": 16,
            },
          },
          "range": [
            413,
            414,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 29,
              "index": 422,
              "line": 16,
            },
            "start": {
              "column": 21,
              "index": 414,
              "line": 16,
            },
          },
          "range": [
            414,
            422,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 30,
              "index": 423,
              "line": 16,
            },
            "start": {
              "column": 29,
              "index": 422,
              "line": 16,
            },
          },
          "range": [
            422,
            423,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "line": 18,
            },
            "start": {
              "column": 30,
              "line": 16,
            },
          },
          "range": [
            423,
            451,
          ],
          "value": "
        You may also try going
        ",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 452,
              "line": 18,
            },
            "start": {
              "column": 2,
              "index": 451,
              "line": 18,
            },
          },
          "range": [
            451,
            452,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 7,
              "index": 456,
              "line": 18,
            },
            "start": {
              "column": 3,
              "index": 452,
              "line": 18,
            },
          },
          "range": [
            452,
            456,
          ],
          "value": "Link",
        },
        {
          "loc": {
            "end": {
              "column": 12,
              "index": 461,
              "line": 18,
            },
            "start": {
              "column": 8,
              "index": 457,
              "line": 18,
            },
          },
          "range": [
            457,
            461,
          ],
          "value": "href",
        },
        {
          "loc": {
            "end": {
              "column": 13,
              "index": 462,
              "line": 18,
            },
            "start": {
              "column": 12,
              "index": 461,
              "line": 18,
            },
          },
          "range": [
            461,
            462,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 16,
              "line": 18,
            },
            "start": {
              "column": 13,
              "line": 18,
            },
          },
          "range": [
            462,
            465,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 22,
              "index": 471,
              "line": 18,
            },
            "start": {
              "column": 17,
              "index": 466,
              "line": 18,
            },
          },
          "range": [
            466,
            471,
          ],
          "value": "style",
        },
        {
          "loc": {
            "end": {
              "column": 23,
              "index": 472,
              "line": 18,
            },
            "start": {
              "column": 22,
              "index": 471,
              "line": 18,
            },
          },
          "range": [
            471,
            472,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 67,
              "line": 18,
            },
            "start": {
              "column": 23,
              "line": 18,
            },
          },
          "range": [
            472,
            516,
          ],
          "value": "width: max-content; display: inline-block;",
        },
        {
          "loc": {
            "end": {
              "column": 68,
              "index": 517,
              "line": 18,
            },
            "start": {
              "column": 67,
              "index": 516,
              "line": 18,
            },
          },
          "range": [
            516,
            517,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 89,
              "line": 18,
            },
            "start": {
              "column": 68,
              "line": 18,
            },
          },
          "range": [
            517,
            538,
          ],
          "value": "back to the beginning",
        },
        {
          "loc": {
            "end": {
              "column": 90,
              "index": 539,
              "line": 18,
            },
            "start": {
              "column": 89,
              "index": 538,
              "line": 18,
            },
          },
          "range": [
            538,
            539,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 91,
              "index": 540,
              "line": 18,
            },
            "start": {
              "column": 90,
              "index": 539,
              "line": 18,
            },
          },
          "range": [
            539,
            540,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 95,
              "index": 544,
              "line": 18,
            },
            "start": {
              "column": 91,
              "index": 540,
              "line": 18,
            },
          },
          "range": [
            540,
            544,
          ],
          "value": "Link",
        },
        {
          "loc": {
            "end": {
              "column": 96,
              "index": 545,
              "line": 18,
            },
            "start": {
              "column": 95,
              "index": 544,
              "line": 18,
            },
          },
          "range": [
            544,
            545,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 1,
              "index": 547,
              "line": 19,
            },
            "start": {
              "column": 0,
              "index": 546,
              "line": 19,
            },
          },
          "range": [
            546,
            547,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "index": 548,
              "line": 19,
            },
            "start": {
              "column": 1,
              "index": 547,
              "line": 19,
            },
          },
          "range": [
            547,
            548,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 556,
              "line": 19,
            },
            "start": {
              "column": 2,
              "index": 548,
              "line": 19,
            },
          },
          "range": [
            548,
            556,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 557,
              "line": 19,
            },
            "start": {
              "column": 10,
              "index": 556,
              "line": 19,
            },
          },
          "range": [
            556,
            557,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 19,
            },
            "start": {
              "column": 18,
              "line": 19,
            },
          },
          "range": [
            557,
            558,
          ],
          "value": ";",
        },
        {
          "loc": {
            "end": {
              "column": 6,
              "line": 21,
            },
            "start": {
              "column": 0,
              "line": 21,
            },
          },
          "range": [
            560,
            566,
          ],
          "value": "export",
        },
        {
          "loc": {
            "end": {
              "column": 12,
              "line": 21,
            },
            "start": {
              "column": 7,
              "line": 21,
            },
          },
          "range": [
            567,
            572,
          ],
          "value": "const",
        },
        {
          "loc": {
            "end": {
              "column": 21,
              "line": 21,
            },
            "start": {
              "column": 13,
              "line": 21,
            },
          },
          "range": [
            573,
            581,
          ],
          "value": "NotFound",
        },
        {
          "loc": {
            "end": {
              "column": 23,
              "line": 21,
            },
            "start": {
              "column": 22,
              "line": 21,
            },
          },
          "range": [
            582,
            583,
          ],
          "value": "=",
        },
        {
          "loc": {
            "end": {
              "column": 25,
              "index": 585,
              "line": 21,
            },
            "start": {
              "column": 24,
              "index": 584,
              "line": 21,
            },
          },
          "range": [
            584,
            585,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 33,
              "index": 593,
              "line": 21,
            },
            "start": {
              "column": 25,
              "index": 585,
              "line": 21,
            },
          },
          "range": [
            585,
            593,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 34,
              "index": 594,
              "line": 21,
            },
            "start": {
              "column": 33,
              "index": 593,
              "line": 21,
            },
          },
          "range": [
            593,
            594,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 34,
              "line": 22,
            },
            "start": {
              "column": 34,
              "line": 21,
            },
          },
          "range": [
            594,
            629,
          ],
          "value": "
        Prose for the current tutorial, ",
        },
        {
          "loc": {
            "end": {
              "column": 35,
              "index": 630,
              "line": 22,
            },
            "start": {
              "column": 34,
              "index": 629,
              "line": 22,
            },
          },
          "range": [
            629,
            630,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 46,
              "index": 641,
              "line": 22,
            },
            "start": {
              "column": 35,
              "index": 630,
              "line": 22,
            },
          },
          "range": [
            630,
            641,
          ],
          "value": "CurrentPath",
        },
        {
          "loc": {
            "end": {
              "column": 48,
              "index": 643,
              "line": 22,
            },
            "start": {
              "column": 47,
              "index": 642,
              "line": 22,
            },
          },
          "range": [
            642,
            643,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 49,
              "index": 644,
              "line": 22,
            },
            "start": {
              "column": 48,
              "index": 643,
              "line": 22,
            },
          },
          "range": [
            643,
            644,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "line": 27,
            },
            "start": {
              "column": 49,
              "line": 22,
            },
          },
          "range": [
            644,
            755,
          ],
          "value": ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 756,
              "line": 27,
            },
            "start": {
              "column": 2,
              "index": 755,
              "line": 27,
            },
          },
          "range": [
            755,
            756,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "index": 758,
              "line": 27,
            },
            "start": {
              "column": 3,
              "index": 756,
              "line": 27,
            },
          },
          "range": [
            756,
            758,
          ],
          "value": "br",
        },
        {
          "loc": {
            "end": {
              "column": 7,
              "index": 760,
              "line": 27,
            },
            "start": {
              "column": 6,
              "index": 759,
              "line": 27,
            },
          },
          "range": [
            759,
            760,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 8,
              "index": 761,
              "line": 27,
            },
            "start": {
              "column": 7,
              "index": 760,
              "line": 27,
            },
          },
          "range": [
            760,
            761,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 9,
              "index": 762,
              "line": 27,
            },
            "start": {
              "column": 8,
              "index": 761,
              "line": 27,
            },
          },
          "range": [
            761,
            762,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 764,
              "line": 27,
            },
            "start": {
              "column": 9,
              "index": 762,
              "line": 27,
            },
          },
          "range": [
            762,
            764,
          ],
          "value": "br",
        },
        {
          "loc": {
            "end": {
              "column": 13,
              "index": 766,
              "line": 27,
            },
            "start": {
              "column": 12,
              "index": 765,
              "line": 27,
            },
          },
          "range": [
            765,
            766,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 14,
              "index": 767,
              "line": 27,
            },
            "start": {
              "column": 13,
              "index": 766,
              "line": 27,
            },
          },
          "range": [
            766,
            767,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 771,
              "line": 28,
            },
            "start": {
              "column": 2,
              "index": 770,
              "line": 28,
            },
          },
          "range": [
            770,
            771,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 14,
              "index": 782,
              "line": 28,
            },
            "start": {
              "column": 3,
              "index": 771,
              "line": 28,
            },
          },
          "range": [
            771,
            782,
          ],
          "value": "ReportIssue",
        },
        {
          "loc": {
            "end": {
              "column": 16,
              "index": 784,
              "line": 28,
            },
            "start": {
              "column": 15,
              "index": 783,
              "line": 28,
            },
          },
          "range": [
            783,
            784,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "index": 785,
              "line": 28,
            },
            "start": {
              "column": 16,
              "index": 784,
              "line": 28,
            },
          },
          "range": [
            784,
            785,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 790,
              "line": 30,
            },
            "start": {
              "column": 2,
              "index": 789,
              "line": 30,
            },
          },
          "range": [
            789,
            790,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 5,
              "index": 792,
              "line": 30,
            },
            "start": {
              "column": 3,
              "index": 790,
              "line": 30,
            },
          },
          "range": [
            790,
            792,
          ],
          "value": "br",
        },
        {
          "loc": {
            "end": {
              "column": 7,
              "index": 794,
              "line": 30,
            },
            "start": {
              "column": 6,
              "index": 793,
              "line": 30,
            },
          },
          "range": [
            793,
            794,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 8,
              "index": 795,
              "line": 30,
            },
            "start": {
              "column": 7,
              "index": 794,
              "line": 30,
            },
          },
          "range": [
            794,
            795,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 9,
              "index": 796,
              "line": 30,
            },
            "start": {
              "column": 8,
              "index": 795,
              "line": 30,
            },
          },
          "range": [
            795,
            796,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 798,
              "line": 30,
            },
            "start": {
              "column": 9,
              "index": 796,
              "line": 30,
            },
          },
          "range": [
            796,
            798,
          ],
          "value": "br",
        },
        {
          "loc": {
            "end": {
              "column": 13,
              "index": 800,
              "line": 30,
            },
            "start": {
              "column": 12,
              "index": 799,
              "line": 30,
            },
          },
          "range": [
            799,
            800,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 14,
              "index": 801,
              "line": 30,
            },
            "start": {
              "column": 13,
              "index": 800,
              "line": 30,
            },
          },
          "range": [
            800,
            801,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 15,
              "index": 802,
              "line": 30,
            },
            "start": {
              "column": 14,
              "index": 801,
              "line": 30,
            },
          },
          "range": [
            801,
            802,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "index": 804,
              "line": 30,
            },
            "start": {
              "column": 15,
              "index": 802,
              "line": 30,
            },
          },
          "range": [
            802,
            804,
          ],
          "value": "br",
        },
        {
          "loc": {
            "end": {
              "column": 18,
              "index": 805,
              "line": 30,
            },
            "start": {
              "column": 17,
              "index": 804,
              "line": 30,
            },
          },
          "range": [
            804,
            805,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 3,
              "index": 809,
              "line": 31,
            },
            "start": {
              "column": 2,
              "index": 808,
              "line": 31,
            },
          },
          "range": [
            808,
            809,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 14,
              "index": 820,
              "line": 31,
            },
            "start": {
              "column": 3,
              "index": 809,
              "line": 31,
            },
          },
          "range": [
            809,
            820,
          ],
          "value": "BackToStart",
        },
        {
          "loc": {
            "end": {
              "column": 16,
              "index": 822,
              "line": 31,
            },
            "start": {
              "column": 15,
              "index": 821,
              "line": 31,
            },
          },
          "range": [
            821,
            822,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 17,
              "index": 823,
              "line": 31,
            },
            "start": {
              "column": 16,
              "index": 822,
              "line": 31,
            },
          },
          "range": [
            822,
            823,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 1,
              "index": 825,
              "line": 32,
            },
            "start": {
              "column": 0,
              "index": 824,
              "line": 32,
            },
          },
          "range": [
            824,
            825,
          ],
          "value": "<",
        },
        {
          "loc": {
            "end": {
              "column": 2,
              "index": 826,
              "line": 32,
            },
            "start": {
              "column": 1,
              "index": 825,
              "line": 32,
            },
          },
          "range": [
            825,
            826,
          ],
          "value": "/",
        },
        {
          "loc": {
            "end": {
              "column": 10,
              "index": 834,
              "line": 32,
            },
            "start": {
              "column": 2,
              "index": 826,
              "line": 32,
            },
          },
          "range": [
            826,
            834,
          ],
          "value": "template",
        },
        {
          "loc": {
            "end": {
              "column": 11,
              "index": 835,
              "line": 32,
            },
            "start": {
              "column": 10,
              "index": 834,
              "line": 32,
            },
          },
          "range": [
            834,
            835,
          ],
          "value": ">",
        },
        {
          "loc": {
            "end": {
              "column": 19,
              "line": 32,
            },
            "start": {
              "column": 18,
              "line": 32,
            },
          },
          "range": [
            835,
            836,
          ],
          "value": ";",
        },
      ]
    `);
  });

  it('all nodes have tokens', () => {
    const source = new SourceCode({ ...result, text });
    traverse(result.visitorKeys, result.ast, (path) => {
      expect(source.getTokens(path.node)).not.toHaveLength(0);
    });
  });

  it('node ranges are correct', () => {
    const nodes = [];
    traverse(result.visitorKeys, result.ast, (path) => {
      nodes.push(path.node);
    });
    expect(nodes.map((n) => ({ type: n.type, slice: text.slice(...n.range) })))
      .toMatchInlineSnapshot(`
      [
        {
          "slice": "import { ExternalLink, Link, service } from 'limber-ui';

      const ReportIssue = <template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>;

      const CurrentPath = <template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>;

      const BackToStart = <template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>;

      export const NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>;
          ",
          "type": "Program",
        },
        {
          "slice": "export const NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>;",
          "type": "ExportNamedDeclaration",
        },
        {
          "slice": "const NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>;",
          "type": "VariableDeclaration",
        },
        {
          "slice": "NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>",
          "type": "VariableDeclarator",
        },
        {
          "slice": "<template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>",
          "type": "GlimmerTemplate",
        },
        {
          "slice": "<template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart />
      </template>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<BackToStart />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<br>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<br />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<br />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<ReportIssue />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<br />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<br />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<CurrentPath />",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "
        Prose for the current tutorial, ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "NotFound",
          "type": "Identifier",
        },
        {
          "slice": "const BackToStart = <template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>;",
          "type": "VariableDeclaration",
        },
        {
          "slice": "BackToStart = <template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
          "type": "VariableDeclarator",
        },
        {
          "slice": "<template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
          "type": "GlimmerTemplate",
        },
        {
          "slice": "<template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "<Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "back to the beginning",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "style="width: max-content; display: inline-block;"",
          "type": "GlimmerAttrNode",
        },
        {
          "slice": ""width: max-content; display: inline-block;"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "href="/"",
          "type": "GlimmerAttrNode",
        },
        {
          "slice": ""/"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "
        You may also try going
        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "BackToStart",
          "type": "Identifier",
        },
        {
          "slice": "const CurrentPath = <template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>;",
          "type": "VariableDeclaration",
        },
        {
          "slice": "CurrentPath = <template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
          "type": "VariableDeclarator",
        },
        {
          "slice": "<template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
          "type": "GlimmerTemplate",
        },
        {
          "slice": "<template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "{{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}",
          "type": "GlimmerBlockStatement",
        },
        {
          "slice": "
          <code>{{docs.currentPath}}</code>
        ",
          "type": "GlimmerBlock",
        },
        {
          "slice": "<code>{{docs.currentPath}}</code>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "{{docs.currentPath}}",
          "type": "GlimmerMustacheStatement",
        },
        {
          "slice": "docs.currentPath",
          "type": "GlimmerPathExpression",
        },
        {
          "slice": "(service "docs")",
          "type": "GlimmerSubExpression",
        },
        {
          "slice": ""docs"",
          "type": "GlimmerStringLiteral",
        },
        {
          "slice": "service",
          "type": "GlimmerPathExpression",
        },
        {
          "slice": "let",
          "type": "GlimmerPathExpression",
        },
        {
          "slice": "CurrentPath",
          "type": "Identifier",
        },
        {
          "slice": "const ReportIssue = <template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>;",
          "type": "VariableDeclaration",
        },
        {
          "slice": "ReportIssue = <template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
          "type": "VariableDeclarator",
        },
        {
          "slice": "<template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
          "type": "GlimmerTemplate",
        },
        {
          "slice": "<template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": ".
        ❤️
      ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>",
          "type": "GlimmerElementNode",
        },
        {
          "slice": "please report the issue",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "href="https://github.com/NullVoxPopuli/limber/issues"",
          "type": "GlimmerAttrNode",
        },
        {
          "slice": ""https://github.com/NullVoxPopuli/limber/issues"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "
        If the tutorial navigated you here,
        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "ReportIssue",
          "type": "Identifier",
        },
        {
          "slice": "import { ExternalLink, Link, service } from 'limber-ui';",
          "type": "ImportDeclaration",
        },
        {
          "slice": "'limber-ui'",
          "type": "Literal",
        },
        {
          "slice": "service",
          "type": "ImportSpecifier",
        },
        {
          "slice": "service",
          "type": "Identifier",
        },
        {
          "slice": "service",
          "type": "Identifier",
        },
        {
          "slice": "Link",
          "type": "ImportSpecifier",
        },
        {
          "slice": "Link",
          "type": "Identifier",
        },
        {
          "slice": "Link",
          "type": "Identifier",
        },
        {
          "slice": "ExternalLink",
          "type": "ImportSpecifier",
        },
        {
          "slice": "ExternalLink",
          "type": "Identifier",
        },
        {
          "slice": "ExternalLink",
          "type": "Identifier",
        },
      ]
    `);
  });

  it('token ranges are correct', () => {
    const tokens = result.ast.tokens;
    expect(tokens.map((n) => ({ type: n.type, slice: text.slice(...n.range) })))
      .toMatchInlineSnapshot(`
      [
        {
          "slice": "import",
          "type": "Keyword",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "ExternalLink",
          "type": "Identifier",
        },
        {
          "slice": ",",
          "type": "Punctuator",
        },
        {
          "slice": "Link",
          "type": "Identifier",
        },
        {
          "slice": ",",
          "type": "Punctuator",
        },
        {
          "slice": "service",
          "type": "Identifier",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "from",
          "type": "Identifier",
        },
        {
          "slice": "'limber-ui'",
          "type": "String",
        },
        {
          "slice": ";",
          "type": "Punctuator",
        },
        {
          "slice": "const",
          "type": "Keyword",
        },
        {
          "slice": "ReportIssue",
          "type": "Identifier",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "
        If the tutorial navigated you here,
        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "ExternalLink",
          "type": "word",
        },
        {
          "slice": "href",
          "type": "word",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": ""https://github.com/NullVoxPopuli/limber/issues"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "please report the issue",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "ExternalLink",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ".
        ❤️
      ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ";",
          "type": "Punctuator",
        },
        {
          "slice": "const",
          "type": "Keyword",
        },
        {
          "slice": "CurrentPath",
          "type": "Identifier",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "#",
          "type": "Punctuator",
        },
        {
          "slice": "let",
          "type": "word",
        },
        {
          "slice": "(",
          "type": "Punctuator",
        },
        {
          "slice": "service",
          "type": "word",
        },
        {
          "slice": """,
          "type": "Punctuator",
        },
        {
          "slice": "docs",
          "type": "word",
        },
        {
          "slice": """,
          "type": "Punctuator",
        },
        {
          "slice": ")",
          "type": "Punctuator",
        },
        {
          "slice": "as",
          "type": "word",
        },
        {
          "slice": "|",
          "type": "Punctuator",
        },
        {
          "slice": "docs",
          "type": "word",
        },
        {
          "slice": "|",
          "type": "Punctuator",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "code",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "docs",
          "type": "word",
        },
        {
          "slice": ".",
          "type": "Punctuator",
        },
        {
          "slice": "currentPath",
          "type": "word",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "code",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "{",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "let",
          "type": "word",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "}",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ";",
          "type": "Punctuator",
        },
        {
          "slice": "const",
          "type": "Keyword",
        },
        {
          "slice": "BackToStart",
          "type": "Identifier",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "
        You may also try going
        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "Link",
          "type": "word",
        },
        {
          "slice": "href",
          "type": "word",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": ""/"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "style",
          "type": "word",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": ""width: max-content; display: inline-block;"",
          "type": "GlimmerTextNode",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "back to the beginning",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "Link",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ";",
          "type": "Punctuator",
        },
        {
          "slice": "export",
          "type": "Keyword",
        },
        {
          "slice": "const",
          "type": "Keyword",
        },
        {
          "slice": "NotFound",
          "type": "Identifier",
        },
        {
          "slice": "=",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "
        Prose for the current tutorial, ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "CurrentPath",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
          "type": "GlimmerTextNode",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "br",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "br",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "ReportIssue",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "br",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "br",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "br",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "BackToStart",
          "type": "word",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": "<",
          "type": "Punctuator",
        },
        {
          "slice": "/",
          "type": "Punctuator",
        },
        {
          "slice": "template",
          "type": "word",
        },
        {
          "slice": ">",
          "type": "Punctuator",
        },
        {
          "slice": ";",
          "type": "Punctuator",
        },
      ]
    `);
  });

  it('node tokens are correct', () => {
    const source = new SourceCode({ ...result, text });
    const nodes = [];
    traverse(result.visitorKeys, result.ast, (path) => {
      nodes.push(path.node);
    });
    expect(nodes.map((n) => ({ type: n.type, tokens: source.getTokens(n).map((t) => t.value) })))
      .toMatchInlineSnapshot(`
      [
        {
          "tokens": [
            "import",
            "{",
            "ExternalLink",
            ",",
            "Link",
            ",",
            "service",
            "}",
            "from",
            "'limber-ui'",
            ";",
            "const",
            "ReportIssue",
            "=",
            "<",
            "template",
            ">",
            "
        If the tutorial navigated you here,
        ",
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
            ".
        ❤️
      ",
            "<",
            "/",
            "template",
            ">",
            ";",
            "const",
            "CurrentPath",
            "=",
            "<",
            "template",
            ">",
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
            "<",
            "/",
            "template",
            ">",
            ";",
            "const",
            "BackToStart",
            "=",
            "<",
            "template",
            ">",
            "
        You may also try going
        ",
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
            "<",
            "/",
            "template",
            ">",
            ";",
            "export",
            "const",
            "NotFound",
            "=",
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "Program",
        },
        {
          "tokens": [
            "export",
            "const",
            "NotFound",
            "=",
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "ExportNamedDeclaration",
        },
        {
          "tokens": [
            "const",
            "NotFound",
            "=",
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "VariableDeclaration",
        },
        {
          "tokens": [
            "NotFound",
            "=",
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclarator",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerTemplate",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        Prose for the current tutorial, ",
            "<",
            "CurrentPath",
            "/",
            ">",
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "ReportIssue",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            "/",
            ">",
            "<",
            "br",
            ">",
            "<",
            "BackToStart",
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "BackToStart",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "br",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "ReportIssue",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "<",
            "CurrentPath",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "
        Prose for the current tutorial, ",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "NotFound",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "const",
            "BackToStart",
            "=",
            "<",
            "template",
            ">",
            "
        You may also try going
        ",
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "VariableDeclaration",
        },
        {
          "tokens": [
            "BackToStart",
            "=",
            "<",
            "template",
            ">",
            "
        You may also try going
        ",
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclarator",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        You may also try going
        ",
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerTemplate",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        You may also try going
        ",
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "<",
            "Link",
            "href",
            "=",
            "/",
            "style",
            "=",
            "width: max-content; display: inline-block;",
            ">",
            "back to the beginning",
            "<",
            "/",
            "Link",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "back to the beginning",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "style",
            "=",
            "width: max-content; display: inline-block;",
          ],
          "type": "GlimmerAttrNode",
        },
        {
          "tokens": [
            "width: max-content; display: inline-block;",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "href",
            "=",
            "/",
          ],
          "type": "GlimmerAttrNode",
        },
        {
          "tokens": [
            "/",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "
        You may also try going
        ",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "BackToStart",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "const",
            "CurrentPath",
            "=",
            "<",
            "template",
            ">",
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "VariableDeclaration",
        },
        {
          "tokens": [
            "CurrentPath",
            "=",
            "<",
            "template",
            ">",
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclarator",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerTemplate",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "{",
            "{",
            "#",
            "let",
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
            "as",
            "|",
            "docs",
            "|",
            "}",
            "}",
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
            "{",
            "{",
            "/",
            "let",
            "}",
            "}",
          ],
          "type": "GlimmerBlockStatement",
        },
        {
          "tokens": [
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
          ],
          "type": "GlimmerBlock",
        },
        {
          "tokens": [
            "<",
            "code",
            ">",
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
            "<",
            "/",
            "code",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "{",
            "{",
            "docs",
            ".",
            "currentPath",
            "}",
            "}",
          ],
          "type": "GlimmerMustacheStatement",
        },
        {
          "tokens": [
            "docs",
            ".",
            "currentPath",
          ],
          "type": "GlimmerPathExpression",
        },
        {
          "tokens": [
            "(",
            "service",
            """,
            "docs",
            """,
            ")",
          ],
          "type": "GlimmerSubExpression",
        },
        {
          "tokens": [
            """,
            "docs",
            """,
          ],
          "type": "GlimmerStringLiteral",
        },
        {
          "tokens": [
            "service",
          ],
          "type": "GlimmerPathExpression",
        },
        {
          "tokens": [
            "let",
          ],
          "type": "GlimmerPathExpression",
        },
        {
          "tokens": [
            "CurrentPath",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "const",
            "ReportIssue",
            "=",
            "<",
            "template",
            ">",
            "
        If the tutorial navigated you here,
        ",
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
            ".
        ❤️
      ",
            "<",
            "/",
            "template",
            ">",
            ";",
          ],
          "type": "VariableDeclaration",
        },
        {
          "tokens": [
            "ReportIssue",
            "=",
            "<",
            "template",
            ">",
            "
        If the tutorial navigated you here,
        ",
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
            ".
        ❤️
      ",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclarator",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        If the tutorial navigated you here,
        ",
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
            ".
        ❤️
      ",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerTemplate",
        },
        {
          "tokens": [
            "<",
            "template",
            ">",
            "
        If the tutorial navigated you here,
        ",
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
            ".
        ❤️
      ",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            ".
        ❤️
      ",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "<",
            "ExternalLink",
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
            ">",
            "please report the issue",
            "<",
            "/",
            "ExternalLink",
            ">",
          ],
          "type": "GlimmerElementNode",
        },
        {
          "tokens": [
            "please report the issue",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
          ],
          "type": "GlimmerAttrNode",
        },
        {
          "tokens": [
            "https://github.com/NullVoxPopuli/limber/issues",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "
        If the tutorial navigated you here,
        ",
          ],
          "type": "GlimmerTextNode",
        },
        {
          "tokens": [
            "ReportIssue",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "import",
            "{",
            "ExternalLink",
            ",",
            "Link",
            ",",
            "service",
            "}",
            "from",
            "'limber-ui'",
            ";",
          ],
          "type": "ImportDeclaration",
        },
        {
          "tokens": [
            "'limber-ui'",
          ],
          "type": "Literal",
        },
        {
          "tokens": [
            "service",
          ],
          "type": "ImportSpecifier",
        },
        {
          "tokens": [
            "service",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "service",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "Link",
          ],
          "type": "ImportSpecifier",
        },
        {
          "tokens": [
            "Link",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "Link",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "ExternalLink",
          ],
          "type": "ImportSpecifier",
        },
        {
          "tokens": [
            "ExternalLink",
          ],
          "type": "Identifier",
        },
        {
          "tokens": [
            "ExternalLink",
          ],
          "type": "Identifier",
        },
      ]
    `);
  });
});
