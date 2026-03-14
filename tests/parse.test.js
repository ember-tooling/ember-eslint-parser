import { describe, expect, it } from 'vitest';
import { parse } from '../src/parser/gjs-gts-parser.js';
import { findNode, findAllNodes } from './helpers.js';

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

    const template = findNode(ast, 'GlimmerTemplate');
    expect(template).toBeTruthy();

    const element = findNode(ast, 'GlimmerElementNode');
    expect(element).toBeTruthy();

    const elements = findAllNodes(ast, 'GlimmerElementNode');
    const h1 = elements.find((e) => e.tag === 'h1');
    expect(h1).toBeTruthy();
    expect(h1.tag).toBe('h1');

    const mustache = findNode(ast, 'GlimmerMustacheStatement');
    expect(mustache).toBeTruthy();
  });

  it('works with plain JS (no templates)', () => {
    const source = `const x = 1; export default x;`;
    const ast = parse(source, { filePath: 'test.gjs' });
    expect(ast.type).toBe('Program');
  });
});
