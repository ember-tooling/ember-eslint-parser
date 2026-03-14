import { describe, expect, it } from 'vitest';
import { print } from '../src/parser/gjs-gts-parser.js';

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

  it('prints GlimmerCommentStatement (HTML comment)', () => {
    expect(print({ type: 'GlimmerCommentStatement', value: ' todo ' })).toBe('<!-- todo -->');
  });

  it('prints GlimmerMustacheCommentStatement ({{! }})', () => {
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

  it('prints GlimmerElementNodePart', () => {
    expect(print({ type: 'GlimmerElementNodePart', original: 'MyComponent' })).toBe(
      'MyComponent'
    );
  });

  // ── ESTree nodes ───────────────────────────────────────────────
  it('prints Identifier', () => {
    expect(print({ type: 'Identifier', name: 'foo' })).toBe('foo');
  });

  it('prints PrivateIdentifier', () => {
    expect(print({ type: 'PrivateIdentifier', name: 'bar' })).toBe('#bar');
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

  it('prints ExportAllDeclaration', () => {
    const node = {
      type: 'ExportAllDeclaration',
      source: { type: 'Literal', value: './utils', raw: "'./utils'" },
      exported: null,
    };
    expect(print(node)).toBe("export * from './utils';");
  });

  it('prints null/undefined/empty values', () => {
    expect(print(null)).toBe('');
    expect(print(undefined)).toBe('');
    expect(print('')).toBe('');
  });

  it('throws for unknown node types', () => {
    expect(() => print({ type: 'UnknownNodeType' })).toThrow(
      "ember-eslint-parser print: unsupported node type 'UnknownNodeType'"
    );
  });

  it('throws for JSX node types', () => {
    expect(() => print({ type: 'JSXElement' })).toThrow(
      "unsupported JSX node type 'JSXElement'"
    );
    expect(() => print({ type: 'JSXFragment' })).toThrow(
      "unsupported JSX node type 'JSXFragment'"
    );
    expect(() => print({ type: 'JSXText' })).toThrow(
      "unsupported JSX node type 'JSXText'"
    );
  });

  // ── TypeScript nodes ───────────────────────────────────────────
  it('prints TS type keywords', () => {
    expect(print({ type: 'TSAnyKeyword' })).toBe('any');
    expect(print({ type: 'TSStringKeyword' })).toBe('string');
    expect(print({ type: 'TSNumberKeyword' })).toBe('number');
    expect(print({ type: 'TSBooleanKeyword' })).toBe('boolean');
    expect(print({ type: 'TSVoidKeyword' })).toBe('void');
    expect(print({ type: 'TSNullKeyword' })).toBe('null');
    expect(print({ type: 'TSUndefinedKeyword' })).toBe('undefined');
    expect(print({ type: 'TSNeverKeyword' })).toBe('never');
    expect(print({ type: 'TSUnknownKeyword' })).toBe('unknown');
    expect(print({ type: 'TSObjectKeyword' })).toBe('object');
    expect(print({ type: 'TSBigIntKeyword' })).toBe('bigint');
    expect(print({ type: 'TSSymbolKeyword' })).toBe('symbol');
  });

  it('prints TSTypeAnnotation', () => {
    expect(print({ type: 'TSTypeAnnotation', typeAnnotation: { type: 'TSStringKeyword' } })).toBe(
      ': string'
    );
  });

  it('prints TSTypeReference', () => {
    const node = {
      type: 'TSTypeReference',
      typeName: { type: 'Identifier', name: 'Array' },
      typeParameters: {
        type: 'TSTypeParameterInstantiation',
        params: [{ type: 'TSStringKeyword' }],
      },
    };
    expect(print(node)).toBe('Array<string>');
  });

  it('prints TSUnionType', () => {
    const node = {
      type: 'TSUnionType',
      types: [{ type: 'TSStringKeyword' }, { type: 'TSNumberKeyword' }],
    };
    expect(print(node)).toBe('string | number');
  });

  it('prints TSIntersectionType', () => {
    const node = {
      type: 'TSIntersectionType',
      types: [
        { type: 'TSTypeReference', typeName: { type: 'Identifier', name: 'A' } },
        { type: 'TSTypeReference', typeName: { type: 'Identifier', name: 'B' } },
      ],
    };
    expect(print(node)).toBe('A & B');
  });

  it('prints TSArrayType', () => {
    const node = {
      type: 'TSArrayType',
      elementType: { type: 'TSStringKeyword' },
    };
    expect(print(node)).toBe('string[]');
  });

  it('prints TSTupleType', () => {
    const node = {
      type: 'TSTupleType',
      elementTypes: [{ type: 'TSStringKeyword' }, { type: 'TSNumberKeyword' }],
    };
    expect(print(node)).toBe('[string, number]');
  });

  it('prints TSInterfaceDeclaration', () => {
    const node = {
      type: 'TSInterfaceDeclaration',
      id: { type: 'Identifier', name: 'Foo' },
      body: {
        type: 'TSInterfaceBody',
        body: [
          {
            type: 'TSPropertySignature',
            key: { type: 'Identifier', name: 'bar' },
            typeAnnotation: {
              type: 'TSTypeAnnotation',
              typeAnnotation: { type: 'TSStringKeyword' },
            },
          },
        ],
      },
    };
    expect(print(node)).toContain('interface Foo');
    expect(print(node)).toContain('bar: string;');
  });

  it('prints TSTypeAliasDeclaration', () => {
    const node = {
      type: 'TSTypeAliasDeclaration',
      id: { type: 'Identifier', name: 'MyType' },
      typeAnnotation: { type: 'TSStringKeyword' },
    };
    expect(print(node)).toBe('type MyType = string;');
  });

  it('prints TSAsExpression', () => {
    const node = {
      type: 'TSAsExpression',
      expression: { type: 'Identifier', name: 'x' },
      typeAnnotation: { type: 'TSStringKeyword' },
    };
    expect(print(node)).toBe('x as string');
  });

  it('prints TSNonNullExpression', () => {
    const node = {
      type: 'TSNonNullExpression',
      expression: { type: 'Identifier', name: 'x' },
    };
    expect(print(node)).toBe('x!');
  });

  it('prints TSEnumDeclaration', () => {
    const node = {
      type: 'TSEnumDeclaration',
      id: { type: 'Identifier', name: 'Color' },
      members: [
        { type: 'TSEnumMember', id: { type: 'Identifier', name: 'Red' } },
        {
          type: 'TSEnumMember',
          id: { type: 'Identifier', name: 'Blue' },
          initializer: { type: 'Literal', value: 1, raw: '1' },
        },
      ],
    };
    expect(print(node)).toContain('enum Color');
    expect(print(node)).toContain('Red');
    expect(print(node)).toContain('Blue = 1');
  });

  it('prints TSModuleDeclaration', () => {
    const node = {
      type: 'TSModuleDeclaration',
      id: { type: 'Identifier', name: 'MyModule' },
      kind: 'namespace',
      body: {
        type: 'TSModuleBlock',
        body: [],
      },
    };
    expect(print(node)).toContain('namespace MyModule');
  });

  it('prints TSSatisfiesExpression', () => {
    const node = {
      type: 'TSSatisfiesExpression',
      expression: { type: 'Identifier', name: 'x' },
      typeAnnotation: {
        type: 'TSTypeReference',
        typeName: { type: 'Identifier', name: 'Foo' },
      },
    };
    expect(print(node)).toBe('x satisfies Foo');
  });

  it('prints TSConditionalType', () => {
    const node = {
      type: 'TSConditionalType',
      checkType: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: 'T' } },
      extendsType: { type: 'TSStringKeyword' },
      trueType: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: 'A' } },
      falseType: { type: 'TSTypeReference', typeName: { type: 'Identifier', name: 'B' } },
    };
    expect(print(node)).toBe('T extends string ? A : B');
  });

  // ── Control flow statements ────────────────────────────────────
  it('prints ForStatement', () => {
    const node = {
      type: 'ForStatement',
      init: {
        type: 'VariableDeclaration',
        kind: 'let',
        declarations: [
          {
            type: 'VariableDeclarator',
            id: { type: 'Identifier', name: 'i' },
            init: { type: 'Literal', value: 0, raw: '0' },
          },
        ],
      },
      test: {
        type: 'BinaryExpression',
        left: { type: 'Identifier', name: 'i' },
        operator: '<',
        right: { type: 'Literal', value: 10, raw: '10' },
      },
      update: {
        type: 'UpdateExpression',
        operator: '++',
        argument: { type: 'Identifier', name: 'i' },
        prefix: false,
      },
      body: { type: 'BlockStatement', body: [] },
    };
    expect(print(node)).toContain('for (let i = 0; i < 10; i++)');
  });

  it('prints SwitchStatement', () => {
    const node = {
      type: 'SwitchStatement',
      discriminant: { type: 'Identifier', name: 'x' },
      cases: [
        {
          type: 'SwitchCase',
          test: { type: 'Literal', value: 1, raw: '1' },
          consequent: [
            { type: 'ExpressionStatement', expression: { type: 'Identifier', name: 'a' } },
          ],
        },
        {
          type: 'SwitchCase',
          test: null,
          consequent: [
            { type: 'ExpressionStatement', expression: { type: 'Identifier', name: 'b' } },
          ],
        },
      ],
    };
    const result = print(node);
    expect(result).toContain('switch (x)');
    expect(result).toContain('case 1:');
    expect(result).toContain('default:');
  });

  it('prints TryStatement', () => {
    const node = {
      type: 'TryStatement',
      block: { type: 'BlockStatement', body: [] },
      handler: {
        type: 'CatchClause',
        param: { type: 'Identifier', name: 'e' },
        body: { type: 'BlockStatement', body: [] },
      },
      finalizer: { type: 'BlockStatement', body: [] },
    };
    const result = print(node);
    expect(result).toContain('try');
    expect(result).toContain('catch (e)');
    expect(result).toContain('finally');
  });

  it('prints WhileStatement', () => {
    const node = {
      type: 'WhileStatement',
      test: { type: 'Literal', value: true, raw: 'true' },
      body: { type: 'BlockStatement', body: [] },
    };
    expect(print(node)).toContain('while (true)');
  });

  it('prints Super', () => {
    expect(print({ type: 'Super' })).toBe('super');
  });

  it('prints EmptyStatement', () => {
    expect(print({ type: 'EmptyStatement' })).toBe(';');
  });

  it('prints DebuggerStatement', () => {
    expect(print({ type: 'DebuggerStatement' })).toBe('debugger;');
  });

  it('prints BreakStatement', () => {
    expect(print({ type: 'BreakStatement' })).toBe('break;');
  });

  it('prints ContinueStatement', () => {
    expect(print({ type: 'ContinueStatement' })).toBe('continue;');
  });
});
