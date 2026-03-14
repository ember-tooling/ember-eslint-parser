import { describe, expect, it } from 'vitest';
import { parse, print } from '../src/parser/gjs-gts-parser.js';
import { findNode, findAllNodes } from './helpers.js';

describe('parse + print (.gjs)', () => {
  it('round-trips a simple gjs template', () => {
    const source = `const Greeting = <template><h1>Hello</h1></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.type).toBe('Program');
    expect(ast.__visitorKeys).toBeDefined();
    expect(ast.__visitorKeys.GlimmerTemplate).toBeDefined();
  });

  it('parses and identifies Glimmer nodes in gjs', () => {
    const source = `const x = <template><div class="main">{{@name}}</div></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });

    const templates = findAllNodes(ast, 'GlimmerTemplate');
    expect(templates.length).toBeGreaterThan(0);

    const elements = findAllNodes(ast, 'GlimmerElementNode');
    const div = elements.find((e) => e.tag === 'div');
    expect(div).toBeTruthy();

    const mustaches = findAllNodes(ast, 'GlimmerMustacheStatement');
    expect(mustaches.length).toBeGreaterThan(0);
  });

  it('can print a parsed GlimmerElementNode from gjs', () => {
    const source = `const x = <template><br /></template>;`;
    const ast = parse(source, { filePath: 'test.gjs' });

    const template = findNode(ast, 'GlimmerTemplate');
    expect(template).toBeTruthy();
    const printed = print(template);
    expect(printed).toContain('<template>');
    expect(printed).toContain('</template>');
  });

  it('handles multiple templates in a single gjs file', () => {
    const source = `
const A = <template><h1>A</h1></template>;
const B = <template><h2>B</h2></template>;
`;
    const ast = parse(source, { filePath: 'test.gjs' });

    const templates = findAllNodes(ast, 'GlimmerTemplate');
    expect(templates.length).toBe(2);
  });

  it('handles gjs with imports', () => {
    const source = `
import { helper } from 'my-addon';
const Comp = <template>{{helper "arg"}}</template>;
`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.type).toBe('Program');
    expect(ast.body.length).toBeGreaterThan(1);
  });
});
