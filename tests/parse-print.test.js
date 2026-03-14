import { describe, expect, it } from 'vitest';
import { parse, print } from '../src/parser/gjs-gts-parser.js';

describe('parse', () => {
  it('returns an AST with type Program', () => {
    const source = `const x = <template><h1>Hello</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.type).toBe('Program');
  });

  it('defaults filePath to file.gjs when not provided', () => {
    const source = `const x = <template><h1>Hello</h1></template>;`;
    const ast = parse(source);
    expect(ast.type).toBe('Program');
  });

  it('attaches __visitorKeys to the AST', () => {
    const source = `const x = <template><h1>Hello</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.__visitorKeys).toBeDefined();
    expect(ast.__visitorKeys.GlimmerTemplate).toBeDefined();
    expect(ast.__visitorKeys.GlimmerElementNode).toBeDefined();
    expect(ast.__visitorKeys.GlimmerTextNode).toBeDefined();
  });

  it('ensures all nodes with range have start/end properties', () => {
    const source = `const x = <template><h1>Hello {{@name}}</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });

    function checkStartEnd(node, visited = new Set()) {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (node.type && Array.isArray(node.range)) {
        expect(typeof node.start).toBe('number');
        expect(typeof node.end).toBe('number');
        expect(node.start).toBe(node.range[0]);
        expect(node.end).toBe(node.range[1]);
      }
      for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            checkStartEnd(item, visited);
          }
        } else if (val && typeof val === 'object' && val.type) {
          checkStartEnd(val, visited);
        }
      }
    }
    checkStartEnd(ast);
  });

  it('removes circular parent references from Glimmer nodes', () => {
    const source = `const x = <template><h1>Hello {{@name}}</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });

    function checkNoParent(node, visited = new Set()) {
      if (!node || typeof node !== 'object' || visited.has(node)) return;
      visited.add(node);
      if (node.type) {
        expect(
          !('parent' in node) || node.parent === null || typeof node.parent !== 'object'
        ).toBe(true);
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            checkNoParent(item, visited);
          }
        } else if (val && typeof val === 'object' && val.type) {
          checkNoParent(val, visited);
        }
      }
    }
    checkNoParent(ast);
  });

  it('parses Glimmer template nodes into the AST', () => {
    const source = `const Greeting = <template><h1>Hello {{@name}}</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });

    // Find the GlimmerTemplate node in the AST
    function findNode(node, type, visited = new Set()) {
      if (!node || typeof node !== 'object' || visited.has(node)) return null;
      visited.add(node);
      if (node.type === type) return node;
      for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            const found = findNode(item, type, visited);
            if (found) return found;
          }
        } else if (val && typeof val === 'object') {
          const found = findNode(val, type, visited);
          if (found) return found;
        }
      }
      return null;
    }

    const template = findNode(ast, 'GlimmerTemplate');
    expect(template).toBeTruthy();

    const element = findNode(ast, 'GlimmerElementNode');
    expect(element).toBeTruthy();

    // Find h1 specifically (first element might be the template wrapper)
    function findAllNodes(node, type, visited = new Set(), results = []) {
      if (!node || typeof node !== 'object' || visited.has(node)) return results;
      visited.add(node);
      if (node.type === type) results.push(node);
      for (const key of Object.keys(node)) {
        if (key === 'loc') continue;
        const val = node[key];
        if (Array.isArray(val)) {
          for (const item of val) {
            findAllNodes(item, type, visited, results);
          }
        } else if (val && typeof val === 'object') {
          findAllNodes(val, type, visited, results);
        }
      }
      return results;
    }
    const elements = findAllNodes(ast, 'GlimmerElementNode');
    const h1 = elements.find((e) => e.tag === 'h1');
    expect(h1).toBeTruthy();
    expect(h1.tag).toBe('h1');

    const mustache = findNode(ast, 'GlimmerMustacheStatement');
    expect(mustache).toBeTruthy();
  });

  it('works with .gts files', () => {
    const source = `
import Component from '@glimmer/component';
export default class MyComponent extends Component {
  <template><h1>Hello</h1></template>
}
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');
    expect(ast.__visitorKeys.GlimmerTemplate).toBeDefined();
  });

  it('works with plain JS (no templates)', () => {
    const source = `const x = 1; export default x;`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.type).toBe('Program');
  });
});

describe('print', () => {
  // ── Glimmer nodes ──────────────────────────────────────────────
  it('prints GlimmerTemplate', () => {
    const node = {
      type: 'GlimmerTemplate',
      body: [{ type: 'GlimmerTextNode', chars: 'Hello' }],
    };
    expect(print(node)).toBe('<template>Hello</template>');
  });

  it('prints GlimmerElementNode', () => {
    const node = {
      type: 'GlimmerElementNode',
      tag: 'h1',
      attributes: [],
      modifiers: [],
      children: [{ type: 'GlimmerTextNode', chars: 'Hello' }],
      selfClosing: false,
    };
    expect(print(node)).toBe('<h1>Hello</h1>');
  });

  it('prints self-closing GlimmerElementNode', () => {
    const node = {
      type: 'GlimmerElementNode',
      tag: 'br',
      attributes: [],
      modifiers: [],
      children: [],
      selfClosing: true,
    };
    expect(print(node)).toBe('<br />');
  });

  it('prints GlimmerElementNode with attributes', () => {
    const node = {
      type: 'GlimmerElementNode',
      tag: 'div',
      attributes: [
        {
          type: 'GlimmerAttrNode',
          name: 'class',
          value: { type: 'GlimmerTextNode', chars: 'main' },
        },
      ],
      modifiers: [],
      children: [],
      selfClosing: false,
    };
    expect(print(node)).toBe('<div class=main></div>');
  });

  it('prints GlimmerTextNode', () => {
    expect(print({ type: 'GlimmerTextNode', chars: 'Hello world' })).toBe('Hello world');
  });

  it('prints GlimmerMustacheStatement', () => {
    const node = {
      type: 'GlimmerMustacheStatement',
      path: { type: 'GlimmerPathExpression', original: '@name' },
      params: [],
      hash: null,
    };
    expect(print(node)).toBe('{{@name}}');
  });

  it('prints GlimmerMustacheStatement with params', () => {
    const node = {
      type: 'GlimmerMustacheStatement',
      path: { type: 'GlimmerPathExpression', original: 'helper' },
      params: [{ type: 'GlimmerPathExpression', original: 'arg1' }],
      hash: null,
    };
    expect(print(node)).toBe('{{helper arg1}}');
  });

  it('prints GlimmerBlockStatement', () => {
    const node = {
      type: 'GlimmerBlockStatement',
      path: { type: 'GlimmerPathExpression', original: 'each' },
      params: [{ type: 'GlimmerPathExpression', original: '@items' }],
      hash: null,
      body: [{ type: 'GlimmerTextNode', chars: 'item' }],
      inverse: null,
    };
    expect(print(node)).toBe('{{#each @items}}item{{/each}}');
  });

  it('prints GlimmerBlockStatement with inverse', () => {
    const node = {
      type: 'GlimmerBlockStatement',
      path: { type: 'GlimmerPathExpression', original: 'if' },
      params: [{ type: 'GlimmerPathExpression', original: '@cond' }],
      hash: null,
      body: [{ type: 'GlimmerTextNode', chars: 'yes' }],
      inverse: { body: [{ type: 'GlimmerTextNode', chars: 'no' }] },
    };
    expect(print(node)).toBe('{{#if @cond}}yes{{else}}no{{/if}}');
  });

  it('prints GlimmerPathExpression', () => {
    expect(print({ type: 'GlimmerPathExpression', original: 'this.name' })).toBe('this.name');
  });

  it('prints GlimmerSubExpression', () => {
    const node = {
      type: 'GlimmerSubExpression',
      path: { type: 'GlimmerPathExpression', original: 'helper' },
      params: [{ type: 'GlimmerPathExpression', original: 'arg' }],
      hash: null,
    };
    expect(print(node)).toBe('(helper arg)');
  });

  it('prints GlimmerAttrNode', () => {
    const node = {
      type: 'GlimmerAttrNode',
      name: 'class',
      value: { type: 'GlimmerTextNode', chars: 'main' },
    };
    expect(print(node)).toBe('class=main');
  });

  it('prints GlimmerConcatStatement', () => {
    const node = {
      type: 'GlimmerConcatStatement',
      parts: [
        { type: 'GlimmerTextNode', chars: 'hello ' },
        {
          type: 'GlimmerMustacheStatement',
          path: { type: 'GlimmerPathExpression', original: '@name' },
          params: [],
          hash: null,
        },
      ],
    };
    expect(print(node)).toBe('"hello {{@name}}"');
  });

  it('prints GlimmerHash and GlimmerHashPair', () => {
    const node = {
      type: 'GlimmerHash',
      pairs: [
        {
          type: 'GlimmerHashPair',
          key: 'as',
          value: { type: 'GlimmerStringLiteral', value: 'item' },
        },
      ],
    };
    expect(print(node)).toBe('as="item"');
  });

  it('prints Glimmer literal types', () => {
    expect(print({ type: 'GlimmerStringLiteral', value: 'hello' })).toBe('"hello"');
    expect(print({ type: 'GlimmerBooleanLiteral', value: true })).toBe('true');
    expect(print({ type: 'GlimmerNumberLiteral', value: 42 })).toBe('42');
    expect(print({ type: 'GlimmerNullLiteral' })).toBe('null');
    expect(print({ type: 'GlimmerUndefinedLiteral' })).toBe('undefined');
  });

  it('prints GlimmerCommentStatement', () => {
    expect(print({ type: 'GlimmerCommentStatement', value: 'todo' })).toBe('{{!-- todo --}}');
  });

  it('prints GlimmerMustacheCommentStatement', () => {
    expect(print({ type: 'GlimmerMustacheCommentStatement', value: 'todo' })).toBe(
      '{{! todo }}'
    );
  });

  it('prints GlimmerElementModifierStatement', () => {
    const node = {
      type: 'GlimmerElementModifierStatement',
      path: { type: 'GlimmerPathExpression', original: 'on' },
      params: [
        { type: 'GlimmerStringLiteral', value: 'click' },
        { type: 'GlimmerPathExpression', original: 'this.handleClick' },
      ],
      hash: null,
    };
    expect(print(node)).toBe('{{on "click" this.handleClick}}');
  });

  it('prints GlimmerProgram', () => {
    const node = {
      type: 'GlimmerProgram',
      body: [{ type: 'GlimmerTextNode', chars: 'content' }],
    };
    expect(print(node)).toBe('content');
  });

  // ── ESTree nodes ───────────────────────────────────────────────
  it('prints Identifier', () => {
    expect(print({ type: 'Identifier', name: 'foo' })).toBe('foo');
  });

  it('prints Literal', () => {
    expect(print({ type: 'Literal', value: 'hello', raw: "'hello'" })).toBe("'hello'");
    expect(print({ type: 'Literal', value: 42, raw: '42' })).toBe('42');
  });

  it('prints ImportDeclaration', () => {
    const node = {
      type: 'ImportDeclaration',
      specifiers: [
        {
          type: 'ImportDefaultSpecifier',
          local: { type: 'Identifier', name: 'Component' },
        },
      ],
      source: { type: 'Literal', value: '@glimmer/component', raw: "'@glimmer/component'" },
    };
    expect(print(node)).toBe("import Component from '@glimmer/component';");
  });

  it('prints VariableDeclaration', () => {
    const node = {
      type: 'VariableDeclaration',
      kind: 'const',
      declarations: [
        {
          type: 'VariableDeclarator',
          id: { type: 'Identifier', name: 'x' },
          init: { type: 'Literal', value: 1, raw: '1' },
        },
      ],
    };
    expect(print(node)).toBe('const x = 1;');
  });

  it('prints null/undefined/empty values', () => {
    expect(print(null)).toBe('');
    expect(print(undefined)).toBe('');
    expect(print('')).toBe('');
  });
});
