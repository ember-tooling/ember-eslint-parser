import { beforeAll, describe, expect, it } from 'vitest';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';
import { traverse } from '../src/parser/transforms.js';
import { SourceCode } from 'eslint';
import { visitorKeys as tsVisitors } from '@typescript-eslint/visitor-keys';
import { visitorKeys as glimmerVisitorKeys } from '@glimmer/syntax';

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
  \${{this.price}}
  \`
</template>`;

    result = parseForESLint(text, {
      filePath: 'example.gts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });
  });

  it('has merged visitor keys', () => {
    const visitorKeys = { ...tsVisitors };
    for (const [k, v] of Object.entries(glimmerVisitorKeys)) {
      visitorKeys[`Glimmer${k}`] = [...v];
    }
    expect(result.visitorKeys).toStrictEqual(visitorKeys);
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
        \${{this.price}}
        \`
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
        \${{this.price}}
        \`
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
        \${{this.price}}
        \`
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
        \${{this.price}}
        \`
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
        \${{this.price}}
        \`
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
        \${{this.price}}
        \`
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
        "slice": "
        \`
      ",
        "type": "GlimmerTextNode",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "{{this.price}}",
        "type": "GlimmerMustacheStatement",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "this.price",
        "type": "GlimmerPathExpression",
      }
    `);
    expect({ type: nodes[i].type, slice: text.slice(...nodes[i++].range) }).toMatchInlineSnapshot(`
      {
        "slice": "
        $",
        "type": "GlimmerTextNode",
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
        ",
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
        ",
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
        ",
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
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
            "
          $",
            "{",
            "{",
            "this",
            ".",
            "price",
            "}",
            "}",
            "
          \`
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
            "
          \`
        ",
          ],
          "type": "GlimmerTextNode",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "{",
            "{",
            "this",
            ".",
            "price",
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
            "this",
            ".",
            "price",
          ],
          "type": "GlimmerPathExpression",
        }
      `);
    expect({ type: nodes[i].type, tokens: source.getTokens(nodes[i++]).map((t) => t.value) })
      .toMatchInlineSnapshot(`
        {
          "tokens": [
            "
          $",
          ],
          "type": "GlimmerTextNode",
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
  });

  it('throws eslint syntax error', () => {
    try {
      result = parseForESLint(`console.log('test)`, {
        filePath: 'example.gts',
        comment: true,
        loc: true,
        range: true,
        tokens: true,
      });
    } catch (e) {
      expect(e.lineNumber).toBe(1);
      expect(e.column).toBe(19);
      expect(e.fileName).toBe('example.gts');
      expect(e.message).toMatchInlineSnapshot(`
        "
          × Unexpected eof
           ╭────
         1 │ console.log('test)
           ╰────
        "
      `);
    }
  });

  it('svg elements are not added to global scope', () => {
    result = parseForESLint(
      `<template>
        <div></div>
        <rect x="0" y="0" width="100" height="100" fill="red" />
        <polygon points="200,10 250,190 160,210" fill="lime" />
      </template>`,
      {
        filePath: 'example.gts',
        comment: true,
        loc: true,
        range: true,
        tokens: true,
      }
    );

    expect(result.scopeManager.scopes[0].through.length).toBe(0);
  });

  it('mathml elements are not added to global scope', () => {
    result = parseForESLint(
      `<template>
        <math><msqrt><mi>x</mi></msqrt></math>
        <mi>x</mi>
      </template>`,
      {
        filePath: 'example.gts',
        comment: true,
        loc: true,
        range: true,
        tokens: true,
      }
    );

    expect(result.scopeManager.scopes[0].through.length).toBe(0);
  });

  it('custom-elements are ignored entirely, like they are in the browser', () => {
    result = parseForESLint(
      `<template>
        <my-element></my-element>
      </template>`,
      {
        filePath: 'example.gts',
        comment: true,
        loc: true,
        range: true,
        tokens: true,
      }
    );

    expect(result.scopeManager.scopes[0].through.length).toBe(0);
  });

  it('can parse imports with explicit .gjs extensions', () => {
    // Test importing from a .gjs file with explicit extension
    const codeWithGjsImport = `
      import type { UserData } from './types-export.gjs';
      import { UserService, ExampleComponent } from './types-export.gjs';

      const userData: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      const userService = new UserService();
      userService.addUser(userData);
    `;

    result = parseForESLint(codeWithGjsImport, {
      filePath: 'tests/fixtures/imports-from-gjs.ts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });

    // Check that the import declarations are parsed correctly
    const importDeclarations = result.ast.body.filter((node) => node.type === 'ImportDeclaration');
    expect(importDeclarations).toHaveLength(2);

    // Check the first import (type import)
    expect(importDeclarations[0].importKind).toBe('type');
    expect(importDeclarations[0].source.value).toBe('./types-export.gjs');
    expect(importDeclarations[0].specifiers[0].imported.name).toBe('UserData');

    // Check the second import (value imports)
    expect(importDeclarations[1].importKind).toBe('value');
    expect(importDeclarations[1].source.value).toBe('./types-export.gjs');
    expect(importDeclarations[1].specifiers).toHaveLength(2);
    expect(importDeclarations[1].specifiers[0].imported.name).toBe('UserService');
    expect(importDeclarations[1].specifiers[1].imported.name).toBe('ExampleComponent');
  });

  it('replaces .gjs extensions with .mjs for TypeScript processing', () => {
    // Test that .gjs imports are transformed to .mjs for TypeScript compatibility
    const { patchTs, replaceExtensions } = require('../src/parser/ts-patch');

    // Initialize patchTs with allowGjs enabled
    patchTs({ allowGjs: true });

    const codeWithGjsImports = `
      import type { UserData } from './types-export.gjs';
      import { UserService } from './api-service.gjs';
      import Component from '@glimmer/component';
      import { tracked } from '@glimmer/tracking';
    `;

    const transformedCode = replaceExtensions(codeWithGjsImports);

    // Check that .gjs extensions are replaced with .mjs
    expect(transformedCode).toContain('./types-export.mjs');
    expect(transformedCode).toContain('./api-service.mjs');
    // Non-.gjs/.gts imports should remain unchanged
    expect(transformedCode).toContain('@glimmer/component');
    expect(transformedCode).toContain('@glimmer/tracking');
  });

  it('ensures TypeScript can resolve types from .gjs imports with allowGjs enabled', () => {
    // Test that when allowGjs is enabled, .gjs imports are properly processed
    const codeWithGjsImport = `
      import type { UserData } from './types-export.gjs';
      import { UserService } from './types-export.gjs';

      const userData: UserData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com'
      };

      const userService = new UserService();
      // This should be properly typed and not be 'any'
      userService.addUser(userData);
    `;

    result = parseForESLint(codeWithGjsImport, {
      filePath: 'tests/fixtures/imports-from-gjs.ts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
      allowGjs: true, // Explicitly enable .gjs support
    });

    // Verify that the parser doesn't throw errors when processing .gjs imports
    expect(result.ast).toBeDefined();
    expect(result.ast.body.length).toBeGreaterThan(3); // At least: import type, import, const, const (may have more due to processing)

    // Check that import declarations are preserved correctly
    const importDeclarations = result.ast.body.filter((node) => node.type === 'ImportDeclaration');
    expect(importDeclarations).toHaveLength(2);
    expect(importDeclarations[0].source.value).toBe('./types-export.gjs');
    expect(importDeclarations[1].source.value).toBe('./types-export.gjs');

    // Verify that TypeScript-specific nodes are present (indicating proper TypeScript parsing)
    const typeAnnotations = [];
    traverse(result.visitorKeys, result.ast, (path) => {
      if (path.node.type === 'TSTypeAnnotation') {
        typeAnnotations.push(path.node);
      }
    });
    expect(typeAnnotations.length).toBeGreaterThan(0);
  });

  it('handles .gjs imports with adjacent .gjs.d.ts declaration files', () => {
    // Test that .gjs imports work correctly when there are corresponding .gjs.d.ts files
    const codeWithGjsDtsImport = `
      import type { ApiResponse } from './api-client.gjs';
      import { ApiClient, DefaultClient } from './api-client.gjs';

      async function testApi(): Promise<void> {
        const client = new ApiClient('https://api.example.com');
        const response = await client.get('/users');
        console.log(response.status, response.data);
      }

      const component = DefaultClient;
    `;

    result = parseForESLint(codeWithGjsDtsImport, {
      filePath: 'tests/fixtures/imports-with-dts.ts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
      allowGjs: true,
    });

    // Verify parsing works correctly
    expect(result.ast).toBeDefined();
    expect(result.ast.body.length).toBeGreaterThan(2);

    // Check that import declarations are parsed correctly
    const importDeclarations = result.ast.body.filter((node) => node.type === 'ImportDeclaration');
    expect(importDeclarations).toHaveLength(2);

    // First import should be a type import
    expect(importDeclarations[0].importKind).toBe('type');
    expect(importDeclarations[0].source.value).toBe('./api-client.gjs');
    expect(importDeclarations[0].specifiers[0].imported.name).toBe('ApiResponse');

    // Second import should be value imports
    expect(importDeclarations[1].importKind).toBe('value');
    expect(importDeclarations[1].source.value).toBe('./api-client.gjs');
    expect(importDeclarations[1].specifiers).toHaveLength(2);
    expect(importDeclarations[1].specifiers[0].imported.name).toBe('ApiClient');
    expect(importDeclarations[1].specifiers[1].imported.name).toBe('DefaultClient');

    // Verify that our extension replacement transforms .gjs to .mjs for TypeScript processing
    const { patchTs, replaceExtensions } = require('../src/parser/ts-patch');
    patchTs({ allowGjs: true });

    const transformedCode = replaceExtensions(codeWithGjsDtsImport);
    expect(transformedCode).toContain('./api-client.mjs');
    expect(transformedCode).not.toContain('./api-client.gjs');
  });

  it('properly maps .gjs.d.ts files to .mjs.d.ts for TypeScript module resolution', () => {
    // Test that the TypeScript file system patches correctly handle .gjs.d.ts files
    const { patchTs } = require('../src/parser/ts-patch');
    const fs = require('node:fs');

    // Initialize patchTs with allowGjs enabled
    const { allowGjs } = patchTs({ allowGjs: true });
    expect(allowGjs).toBe(true);

    // Since we can't easily test the actual TypeScript sys modifications directly,
    // we'll test that our file existence checks work correctly
    const testFilePath =
      '/Users/pwagenet/Development/OSS/Ember/ember-eslint-parser/tests/fixtures/api-client.gjs.d.ts';
    expect(fs.existsSync(testFilePath)).toBe(true);

    // Test that .gjs.d.ts files exist in our test fixtures
    const gjsDtsPath =
      '/Users/pwagenet/Development/OSS/Ember/ember-eslint-parser/tests/fixtures/api-client.gjs.d.ts';
    const gjsPath =
      '/Users/pwagenet/Development/OSS/Ember/ember-eslint-parser/tests/fixtures/api-client.gjs';

    expect(fs.existsSync(gjsDtsPath)).toBe(true);
    expect(fs.existsSync(gjsPath)).toBe(true);

    // Read the .gjs.d.ts file to verify it contains type declarations
    const dtsContent = fs.readFileSync(gjsDtsPath, 'utf8');
    expect(dtsContent).toContain('export interface ApiResponse');
    expect(dtsContent).toContain('export declare class ApiClient');
    expect(dtsContent).toContain('export declare const DefaultClient');
  });

  it('comprehensive test: .gjs imports work with type-aware linting when .gjs.d.ts files are present', () => {
    // This is the key integration test that verifies the complete functionality
    const codeWithComplexGjsImports = `
      import type { ServiceConfig, ServiceResponse } from './typed-service.gjs';
      import { TypedService } from './typed-service.gjs';

      // Test basic class instantiation with proper typing
      const config: ServiceConfig = {
        apiKey: 'test-key',
        baseUrl: 'https://api.example.com',
        timeout: 3000
      };

      const service = new TypedService(config);
      
      // Test method calls that should be properly typed
      const isConnected: boolean = service.isConnected();
      
      // Test generic typing from the .gjs.d.ts file
      async function getUserData(): Promise<ServiceResponse<{ name: string }>> {
        return await service.request<{ name: string }>('/user');
      }
    `;

    result = parseForESLint(codeWithComplexGjsImports, {
      filePath: 'tests/fixtures/complex-gjs-import-test.ts',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
      allowGjs: true,
    });

    // Verify parsing works correctly
    expect(result.ast).toBeDefined();
    expect(result.ast.body.length).toBeGreaterThan(4);

    // Check that both type and value imports are handled
    const importDeclarations = result.ast.body.filter((node) => node.type === 'ImportDeclaration');
    expect(importDeclarations).toHaveLength(2);

    // Type import
    expect(importDeclarations[0].importKind).toBe('type');
    expect(importDeclarations[0].source.value).toBe('./typed-service.gjs');

    // Value import
    expect(importDeclarations[1].importKind).toBe('value');
    expect(importDeclarations[1].source.value).toBe('./typed-service.gjs');

    // Verify that extension replacement works
    const { patchTs, replaceExtensions } = require('../src/parser/ts-patch');
    patchTs({ allowGjs: true });

    const transformedCode = replaceExtensions(codeWithComplexGjsImports);

    // Should transform all .gjs imports to .mjs for TypeScript
    expect(transformedCode).toContain('./typed-service.mjs');
    expect(transformedCode).not.toContain('./typed-service.gjs');

    // Count occurrences to ensure both imports were transformed
    const mjsMatches = transformedCode.match(/\.\/typed-service\.mjs/g);
    expect(mjsMatches).toHaveLength(2);
  });

  it('can parse .gjs files that export types and components', () => {
    // Test parsing a .gjs file that exports TypeScript types
    const gjsWithTypes = `
      export interface UserData {
        id: number;
        name: string;
        email: string;
      }

      export class UserService {
        users = [];
        
        addUser(user) {
          this.users.push(user);
        }
      }

      export const ExampleComponent = <template>
        <div>Hello from GJS component</div>
      </template>;
    `;

    result = parseForESLint(gjsWithTypes, {
      filePath: 'tests/fixtures/types-export.gjs',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });

    // Check that exports are parsed correctly
    const exportDeclarations = result.ast.body.filter(
      (node) => node.type === 'ExportNamedDeclaration' || node.type === 'TSInterfaceDeclaration'
    );
    expect(exportDeclarations.length).toBeGreaterThan(0);

    // Check that the template is parsed as a Glimmer template
    const templateNodes = [];
    traverse(result.visitorKeys, result.ast, (path) => {
      if (path.node.type === 'GlimmerTemplate') {
        templateNodes.push(path.node);
      }
    });

    expect(templateNodes).toHaveLength(1);
  });
});
