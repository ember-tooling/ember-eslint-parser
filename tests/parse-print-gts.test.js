import { describe, expect, it } from 'vitest';
import { parse, print } from '../src/parser/gjs-gts-parser.js';
import { findNode } from './helpers.js';

describe('parse + print (.gts)', () => {
  it('parses a gts file with a class component', () => {
    const source = `
import Component from '@glimmer/component';
export default class MyComponent extends Component {
  <template><h1>Hello</h1></template>
}
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');
    expect(ast.__visitorKeys).toBeDefined();
    expect(ast.__visitorKeys.GlimmerTemplate).toBeDefined();
  });

  it('parses a gts file with type annotations', () => {
    const source = `
import Component from '@glimmer/component';

interface Args {
  name: string;
}

export default class Greeting extends Component<{ Args: Args }> {
  <template><h1>Hello {{@name}}</h1></template>
}
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');

    const iface = findNode(ast, 'TSInterfaceDeclaration');
    expect(iface).toBeTruthy();

    const template = findNode(ast, 'GlimmerTemplate');
    expect(template).toBeTruthy();
  });

  it('can print GlimmerTemplate from a gts file', () => {
    const source = `
import Component from '@glimmer/component';
export default class MyComponent extends Component {
  <template><p>Content</p></template>
}
`;
    const ast = parse(source, { filePath: 'test.gts' });

    const template = findNode(ast, 'GlimmerTemplate');
    expect(template).toBeTruthy();
    const printed = print(template);
    expect(printed).toContain('<template>');
    expect(printed).toContain('</template>');
  });

  it('handles gts with typed const templates', () => {
    const source = `
const Greeting: TemplateOnlyComponent<{ Args: { name: string } }> = <template>
  Hello {{@name}}
</template>;
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');
  });

  it('handles gts with enum declarations', () => {
    const source = `
enum Color { Red, Green, Blue }
const x = <template>{{Color.Red}}</template>;
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');

    const enumDecl = findNode(ast, 'TSEnumDeclaration');
    expect(enumDecl).toBeTruthy();
  });

  it('handles gts with type aliases', () => {
    const source = `
type Status = 'active' | 'inactive';
const Badge = <template><span>{{@status}}</span></template>;
`;
    const ast = parse(source, { filePath: 'test.gts' });
    expect(ast.type).toBe('Program');

    const typeAlias = findNode(ast, 'TSTypeAliasDeclaration');
    expect(typeAlias).toBeTruthy();
  });
});
