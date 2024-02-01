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
  <BackToStart test="  {{foo}} {{bar}}" />
</template>`;

    result = parseForESLint(text, {
      filePath: 'example.gts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });
  });

  it('all tokens are correct', () => {
    for (const token of result.ast.tokens) {
      let range = token.range;
      if (token.type === 'GlimmerTextNode' && token.parent.type === 'GlimmerAttrNode') {
        range = [range[0] + 1, range[1] - 1];
      }
      expect(token.raw || token.value).toStrictEqual(text.slice(...range));
    }
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
    let i = 0;
    // create following line, duplicate  many times, then update
    // expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot();
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
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
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "Program",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "export const NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "ExportNamedDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "const NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "VariableDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "NotFound = <template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "VariableDeclarator",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "GlimmerTemplate",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        Prose for the current tutorial, <CurrentPath />, could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        <br /><br />
        <ReportIssue />

        <br /><br /><br>
        <BackToStart test="  {{foo}} {{bar}}" />
      </template>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "template",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<BackToStart test="  {{foo}} {{bar}}" />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "BackToStart",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "test="  {{foo}} {{bar}}"",
        "type": "GlimmerAttrNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ""  {{foo}} {{bar}}"",
        "type": "GlimmerConcatStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "{{bar}}",
        "type": "GlimmerMustacheStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "bar",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "{{foo}}",
        "type": "GlimmerMustacheStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "foo",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<br>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "br",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<br />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "br",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<br />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "br",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<ReportIssue />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ReportIssue",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<br />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "br",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<br />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "br",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ", could not be found.

        Please check the URL and try again,
        or navigate to a different tutorial chapter.

        ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<CurrentPath />",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "CurrentPath",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "
        Prose for the current tutorial, ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "NotFound",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "const BackToStart = <template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>;",
        "type": "VariableDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "BackToStart = <template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
        "type": "VariableDeclarator",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
        "type": "GlimmerTemplate",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        You may also try going
        <Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>
      </template>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "template",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<Link href="/" style="width: max-content; display: inline-block;">back to the beginning</Link>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "Link",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "back to the beginning",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "style="width: max-content; display: inline-block;"",
        "type": "GlimmerAttrNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ""width: max-content; display: inline-block;"",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "href="/"",
        "type": "GlimmerAttrNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ""/"",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "
        You may also try going
        ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "BackToStart",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "const CurrentPath = <template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>;",
        "type": "VariableDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "CurrentPath = <template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
        "type": "VariableDeclarator",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
        "type": "GlimmerTemplate",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        {{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}
      </template>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "template",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "{{#let (service "docs") as |docs|}}
          <code>{{docs.currentPath}}</code>
        {{/let}}",
        "type": "GlimmerBlockStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "
          <code>{{docs.currentPath}}</code>
        ",
        "type": "GlimmerBlock",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<code>{{docs.currentPath}}</code>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "code",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "{{docs.currentPath}}",
        "type": "GlimmerMustacheStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "docs.currentPath",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "(service "docs")",
        "type": "GlimmerSubExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ""docs"",
        "type": "GlimmerStringLiteral",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "service",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "let",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "CurrentPath",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "const ReportIssue = <template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>;",
        "type": "VariableDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ReportIssue = <template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
        "type": "VariableDeclarator",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
        "type": "GlimmerTemplate",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<template>
        If the tutorial navigated you here,
        <ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>.
        ❤️
      </template>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "template",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ".
        ❤️
      ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "<ExternalLink href="https://github.com/NullVoxPopuli/limber/issues">please report the issue</ExternalLink>",
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ExternalLink",
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "please report the issue",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "href="https://github.com/NullVoxPopuli/limber/issues"",
        "type": "GlimmerAttrNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": ""https://github.com/NullVoxPopuli/limber/issues"",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "
        If the tutorial navigated you here,
        ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ReportIssue",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "import { ExternalLink, Link, service } from 'limber-ui';",
        "type": "ImportDeclaration",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "'limber-ui'",
        "type": "Literal",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "service",
        "type": "ImportSpecifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "service",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "service",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "Link",
        "type": "ImportSpecifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "Link",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "Link",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ExternalLink",
        "type": "ImportSpecifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ExternalLink",
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "ExternalLink",
        "type": "Identifier",
      }
    `);
  });

  it('node tokens are correct', () => {
    const source = new SourceCode({ ...result, text });
    const nodes = [];
    traverse(result.visitorKeys, result.ast, (path) => {
      nodes.push(path.node);
    });
    let i = 0;
    // create following line, duplicate  many times, then update
    // expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) }).toMatchInlineSnapshot();
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "Program",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "ExportNamedDeclaration",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclaration",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "VariableDeclarator",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerTemplate",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
            "<",
            "/",
            "template",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "template",
        ],
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "BackToStart",
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "BackToStart",
        ],
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "test",
            "=",
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
          ],
          "type": "GlimmerAttrNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            """,
            "{",
            "{",
            "foo",
            "}",
            "}",
            "{",
            "{",
            "bar",
            "}",
            "}",
            """,
          ],
          "type": "GlimmerConcatStatement",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "{",
            "{",
            "bar",
            "}",
            "}",
          ],
          "type": "GlimmerMustacheStatement",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "bar",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "{",
            "{",
            "foo",
            "}",
            "}",
          ],
          "type": "GlimmerMustacheStatement",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "foo",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "br",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "br",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "<",
          "br",
          "/",
          ">",
        ],
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "br",
        ],
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "<",
          "br",
          "/",
          ">",
        ],
        "type": "GlimmerElementNode",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "br",
        ],
        "type": "GlimmerElementNodePart",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "ReportIssue",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "ReportIssue",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "br",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "br",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "br",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            ", could not be found.

          Please check the URL and try again,
          or navigate to a different tutorial chapter.

          ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "<",
            "CurrentPath",
            "/",
            ">",
          ],
          "type": "GlimmerElementNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "CurrentPath",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "
          Prose for the current tutorial, ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "NotFound",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "template",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "Link",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "back to the beginning",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "style",
            "=",
            "width: max-content; display: inline-block;",
          ],
          "type": "GlimmerAttrNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "width: max-content; display: inline-block;",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "href",
            "=",
            "/",
          ],
          "type": "GlimmerAttrNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "/",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "
          You may also try going
          ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "BackToStart",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "template",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "code",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "docs",
            ".",
            "currentPath",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            """,
            "docs",
            """,
          ],
          "type": "GlimmerStringLiteral",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "service",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "let",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "CurrentPath",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "template",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            ".
          ❤️
        ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "ExternalLink",
          ],
          "type": "GlimmerElementNodePart",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "please report the issue",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "href",
            "=",
            "https://github.com/NullVoxPopuli/limber/issues",
          ],
          "type": "GlimmerAttrNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "https://github.com/NullVoxPopuli/limber/issues",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "
          If the tutorial navigated you here,
          ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "ReportIssue",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
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
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "'limber-ui'",
          ],
          "type": "Literal",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "service",
          ],
          "type": "ImportSpecifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "service",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "service",
          ],
          "type": "Identifier",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "Link",
        ],
        "type": "ImportSpecifier",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "Link",
        ],
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "Link",
        ],
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "ExternalLink",
        ],
        "type": "ImportSpecifier",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "ExternalLink",
        ],
        "type": "Identifier",
      }
    `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
      {
        "tokens": [
          "ExternalLink",
        ],
        "type": "Identifier",
      }
    `);
  });
});
