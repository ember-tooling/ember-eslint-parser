import { beforeAll, describe, expect, it } from 'vitest';
import { parseForESLint } from '../src/parser/hbs-parser.js';
import { traverse } from '../src/parser/transforms.js';
import { Linter, SourceCode } from 'eslint';
import { visitorKeys as glimmerVisitorKeys } from '@glimmer/syntax';

describe('hbs-parser', () => {
  let text, result;

  beforeAll(() => {
    text = `<h1>Hello, {{name}}!</h1>

{{#let (service "router") as |router|}}
  <nav>
    {{! this is a comment }}
    <a href={{router.currentURL}}>Home</a>
  </nav>
{{/let}}`;

    result = parseForESLint(text, {
      filePath: 'example.hbs',
      comment: true,
      loc: true,
      range: true,
      tokens: true,
    });
  });

  it('returns a Program node as root', () => {
    expect(result.ast.type).toBe('Program');
  });

  it('has a GlimmerTemplate as first body element', () => {
    expect(result.ast.body[0].type).toBe('GlimmerTemplate');
  });

  it('has correct visitor keys', () => {
    const expectedVisitorKeys = {
      Program: ['body'],
    };
    for (const [k, v] of Object.entries(glimmerVisitorKeys)) {
      expectedVisitorKeys[`Glimmer${k}`] = [...v];
    }
    expectedVisitorKeys.GlimmerTemplate = ['body'];
    if (!expectedVisitorKeys.GlimmerElementNode.includes('blockParamNodes')) {
      expectedVisitorKeys.GlimmerElementNode.push('blockParamNodes', 'parts');
    }
    expect(result.visitorKeys).toStrictEqual(expectedVisitorKeys);
  });

  it('all tokens are correct', () => {
    for (const token of result.ast.tokens) {
      const range = token.range;
      if (
        token.type === 'GlimmerTextNode' &&
        token.parent &&
        token.parent.type === 'GlimmerAttrNode'
      ) {
        // attr value text nodes include quotes in range
        expect(token.raw || token.value).toStrictEqual(text.slice(range[0] + 1, range[1] - 1));
      } else {
        expect(token.raw || token.value).toStrictEqual(text.slice(...range));
      }
    }
  });

  it('has a scope manager', () => {
    expect(result.scopeManager).toBeDefined();
    expect(result.scopeManager.globalScope).toBeDefined();
  });

  it('node ranges are within bounds', () => {
    traverse(result.visitorKeys, result.ast, (path) => {
      const node = path.node;
      if (!node || !node.range) return;
      expect(node.range[0]).toBeGreaterThanOrEqual(0);
      expect(node.range[1]).toBeLessThanOrEqual(text.length);
      expect(node.range[0]).toBeLessThanOrEqual(node.range[1]);
    });
  });

  it('all nodes have tokens', () => {
    const source = new SourceCode({ ...result, text });
    traverse(result.visitorKeys, result.ast, (path) => {
      expect(source.getTokens(path.node)).not.toHaveLength(0);
    });
  });

  it('handles parse errors gracefully', () => {
    expect(() => {
      parseForESLint('{{#if foo}}unclosed', { filePath: 'bad.hbs' });
    }).toThrow();
  });

  it('template range covers full file', () => {
    const template = result.ast.body[0];
    expect(template.range).toStrictEqual([0, text.length]);
  });

  describe('with simple template', () => {
    it('parses a simple mustache', () => {
      const r = parseForESLint('{{greeting}}', { filePath: 'simple.hbs' });
      expect(r.ast.type).toBe('Program');
      expect(r.ast.body[0].type).toBe('GlimmerTemplate');
      expect(r.ast.body[0].body[0].type).toBe('GlimmerMustacheStatement');
    });

    it('parses an element', () => {
      const r = parseForESLint('<div class="foo">bar</div>', { filePath: 'elem.hbs' });
      expect(r.ast.body[0].body[0].type).toBe('GlimmerElementNode');
    });

    it('empty template', () => {
      const r = parseForESLint('', { filePath: 'empty.hbs' });
      expect(r.ast.type).toBe('Program');
      expect(r.ast.body[0].body).toHaveLength(0);
    });
  });

  describe('lint rules', () => {
    let linter;

    beforeAll(() => {
      linter = new Linter();
      linter.defineParser('ember-eslint-parser/hbs', { parseForESLint });
    });

    it('reports an error for <Input> via no-restricted-syntax', () => {
      const messages = linter.verify(
        '<Input @value={{this.val}} />',
        {
          parser: 'ember-eslint-parser/hbs',
          rules: {
            'no-restricted-syntax': [
              'error',
              {
                selector: "GlimmerElementNode[name='Input']",
                message: 'Do not use <Input>; use a native <input> element instead.',
              },
            ],
          },
        },
        { filename: 'test.hbs' }
      );

      expect(messages).toHaveLength(1);
      expect(messages[0].ruleId).toBe('no-restricted-syntax');
      expect(messages[0].severity).toBe(2);
      expect(messages[0].message).toContain('<Input>');
    });

    it('autofixes <Input> to <input /> via a custom fixable rule', () => {
      linter.defineRule('no-input-component', {
        meta: { fixable: 'code' },
        create(context) {
          return {
            GlimmerElementNode(node) {
              if (node.name === 'Input') {
                context.report({
                  node,
                  message: 'Use native <input> instead of <Input>.',
                  fix(fixer) {
                    return fixer.replaceText(node, '<input />');
                  },
                });
              }
            },
          };
        },
      });

      const { fixed, output } = linter.verifyAndFix(
        '<Input @value={{this.val}} />',
        {
          parser: 'ember-eslint-parser/hbs',
          rules: { 'no-input-component': 'error' },
        },
        { filename: 'test.hbs' }
      );

      expect(fixed).toBe(true);
      expect(output).toBe('<input />');
    });
  });
});
