'use strict';

/**
 * Minimal recursive AST printer that handles common ESTree node types
 * and Glimmer template nodes.
 *
 * This is intentionally simple — tools like zmod use span-based patching
 * (preserving the original source for unchanged regions), so this printer
 * is typically only invoked for newly-created AST nodes (via builders).
 *
 * @param {object} node - The AST node to print
 * @return {string}
 */
function print(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;

  switch (node.type) {
    // ── Identifiers & Literals ────────────────────────────────────
    case 'Identifier':
      return node.name;

    case 'Literal':
    case 'StringLiteral':
      if (typeof node.value === 'string') {
        const quote = node.extra?.raw?.[0] ?? node.raw?.[0] ?? '"';
        return `${quote}${node.value}${quote}`;
      }
      if (node.raw != null) return node.raw;
      return String(node.value);

    case 'NumericLiteral':
      return String(node.value);

    case 'BooleanLiteral':
      return String(node.value);

    case 'NullLiteral':
      return 'null';

    case 'RegExpLiteral':
      return `/${node.pattern}/${node.flags ?? ''}`;

    case 'TemplateLiteral': {
      const quasis = node.quasis ?? [];
      const exprs = node.expressions ?? [];
      let result = '`';
      for (let i = 0; i < quasis.length; i++) {
        result += quasis[i].value?.raw ?? quasis[i].value?.cooked ?? '';
        if (i < exprs.length) {
          result += '${' + print(exprs[i]) + '}';
        }
      }
      return result + '`';
    }

    case 'TemplateElement':
      return node.value?.raw ?? '';

    // ── Expressions ────────────────────────────────────────────────
    case 'CallExpression':
    case 'OptionalCallExpression': {
      const callee = print(node.callee);
      const args = (node.arguments ?? []).map(print).join(', ');
      const opt = node.optional ? '?.' : '';
      return `${callee}${opt}(${args})`;
    }

    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const obj = print(node.object);
      const prop = print(node.property);
      if (node.computed) return `${obj}[${prop}]`;
      const opt = node.optional ? '?.' : '.';
      return `${obj}${opt}${prop}`;
    }

    case 'ArrowFunctionExpression': {
      const params = (node.params ?? []).map(print).join(', ');
      const body = print(node.body);
      const async = node.async ? 'async ' : '';
      return `${async}(${params}) => ${body}`;
    }

    case 'FunctionExpression': {
      const id = node.id ? ' ' + print(node.id) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const body = print(node.body);
      const async = node.async ? 'async ' : '';
      const gen = node.generator ? '*' : '';
      return `${async}function${gen}${id}(${params}) ${body}`;
    }

    case 'AssignmentExpression':
      return `${print(node.left)} ${node.operator} ${print(node.right)}`;

    case 'BinaryExpression':
    case 'LogicalExpression':
      return `${print(node.left)} ${node.operator} ${print(node.right)}`;

    case 'UnaryExpression':
      if (node.prefix) {
        const space = node.operator.length > 1 ? ' ' : '';
        return `${node.operator}${space}${print(node.argument)}`;
      }
      return `${print(node.argument)}${node.operator}`;

    case 'UpdateExpression':
      return node.prefix
        ? `${node.operator}${print(node.argument)}`
        : `${print(node.argument)}${node.operator}`;

    case 'ConditionalExpression':
      return `${print(node.test)} ? ${print(node.consequent)} : ${print(node.alternate)}`;

    case 'SequenceExpression':
      return (node.expressions ?? []).map(print).join(', ');

    case 'SpreadElement':
      return `...${print(node.argument)}`;

    case 'YieldExpression':
      return node.delegate
        ? `yield* ${print(node.argument)}`
        : `yield ${print(node.argument)}`;

    case 'AwaitExpression':
      return `await ${print(node.argument)}`;

    case 'TaggedTemplateExpression':
      return `${print(node.tag)}${print(node.quasi)}`;

    case 'NewExpression': {
      const callee = print(node.callee);
      const args = (node.arguments ?? []).map(print).join(', ');
      return `new ${callee}(${args})`;
    }

    case 'ThisExpression':
      return 'this';

    // ── Patterns ───────────────────────────────────────────────────
    case 'ArrayExpression':
    case 'ArrayPattern': {
      const elems = (node.elements ?? []).map((e) => (e ? print(e) : '')).join(', ');
      return `[${elems}]`;
    }

    case 'ObjectExpression':
    case 'ObjectPattern': {
      const props = (node.properties ?? []).map(print).join(', ');
      return `{ ${props} }`;
    }

    case 'Property': {
      const key = print(node.key);
      if (node.shorthand) return key;
      if (node.method) {
        const params = (node.value?.params ?? []).map(print).join(', ');
        const body = print(node.value?.body);
        return `${key}(${params}) ${body}`;
      }
      return `${key}: ${print(node.value)}`;
    }

    case 'RestElement':
      return `...${print(node.argument)}`;

    case 'AssignmentPattern':
      return `${print(node.left)} = ${print(node.right)}`;

    // ── Statements ─────────────────────────────────────────────────
    case 'ExpressionStatement':
      return print(node.expression) + ';';

    case 'BlockStatement': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'ReturnStatement':
      return node.argument ? `return ${print(node.argument)};` : 'return;';

    case 'VariableDeclaration': {
      const decls = (node.declarations ?? []).map(print).join(', ');
      return `${node.kind} ${decls};`;
    }

    case 'VariableDeclarator': {
      const id = print(node.id);
      return node.init ? `${id} = ${print(node.init)}` : id;
    }

    case 'IfStatement': {
      let result = `if (${print(node.test)}) ${print(node.consequent)}`;
      if (node.alternate) result += ` else ${print(node.alternate)}`;
      return result;
    }

    case 'ThrowStatement':
      return `throw ${print(node.argument)};`;

    // ── Declarations ───────────────────────────────────────────────
    case 'FunctionDeclaration': {
      const id = node.id ? print(node.id) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const body = print(node.body);
      const async = node.async ? 'async ' : '';
      const gen = node.generator ? '*' : '';
      return `${async}function${gen} ${id}(${params}) ${body}`;
    }

    case 'ClassDeclaration':
    case 'ClassExpression': {
      const id = node.id ? ` ${print(node.id)}` : '';
      const superClass = node.superClass ? ` extends ${print(node.superClass)}` : '';
      const body = print(node.body);
      return `class${id}${superClass} ${body}`;
    }

    case 'ClassBody': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'MethodDefinition': {
      const key = print(node.key);
      const value = node.value;
      const params = (value?.params ?? []).map(print).join(', ');
      const body = print(value?.body);
      const staticKw = node.static ? 'static ' : '';
      const kind = node.kind === 'get' ? 'get ' : node.kind === 'set' ? 'set ' : '';
      return `${staticKw}${kind}${key}(${params}) ${body}`;
    }

    case 'PropertyDefinition': {
      const key = print(node.key);
      const staticKw = node.static ? 'static ' : '';
      return node.value ? `${staticKw}${key} = ${print(node.value)};` : `${staticKw}${key};`;
    }

    // ── Imports/Exports ────────────────────────────────────────────
    case 'ImportDeclaration': {
      const specs = (node.specifiers ?? []).map(print);
      const source = print(node.source);
      if (specs.length === 0) return `import ${source};`;
      const defaultSpec = specs.find(
        (_, i) => node.specifiers[i].type === 'ImportDefaultSpecifier'
      );
      const namedSpecs = node.specifiers
        .filter((s) => s.type === 'ImportSpecifier')
        .map(print);
      const parts = [];
      if (defaultSpec) parts.push(defaultSpec);
      if (namedSpecs.length) parts.push(`{ ${namedSpecs.join(', ')} }`);
      return `import ${parts.join(', ')} from ${source};`;
    }

    case 'ImportDefaultSpecifier':
      return print(node.local);

    case 'ImportSpecifier': {
      const imported = print(node.imported);
      const local = print(node.local);
      return imported === local ? imported : `${imported} as ${local}`;
    }

    case 'ImportNamespaceSpecifier':
      return `* as ${print(node.local)}`;

    case 'ExportDefaultDeclaration':
      return `export default ${print(node.declaration)}`;

    case 'ExportNamedDeclaration':
      if (node.declaration) return `export ${print(node.declaration)}`;
      if (node.specifiers?.length) {
        const specs = node.specifiers.map(print).join(', ');
        const from = node.source ? ` from ${print(node.source)}` : '';
        return `export { ${specs} }${from};`;
      }
      return '';

    case 'ExportSpecifier': {
      const local = print(node.local);
      const exported = print(node.exported);
      return local === exported ? local : `${local} as ${exported}`;
    }

    // ── JSX ────────────────────────────────────────────────────────
    case 'JSXElement': {
      const open = print(node.openingElement);
      const close = node.closingElement ? print(node.closingElement) : '';
      const children = (node.children ?? []).map(print).join('');
      return `${open}${children}${close}`;
    }

    case 'JSXOpeningElement': {
      const name = print(node.name);
      const attrs = (node.attributes ?? []).map(print).join(' ');
      const attrStr = attrs ? ' ' + attrs : '';
      return node.selfClosing ? `<${name}${attrStr} />` : `<${name}${attrStr}>`;
    }

    case 'JSXClosingElement':
      return `</${print(node.name)}>`;

    case 'JSXIdentifier':
      return node.name;

    case 'JSXMemberExpression':
      return `${print(node.object)}.${print(node.property)}`;

    case 'JSXAttribute': {
      const name = print(node.name);
      return node.value ? `${name}=${print(node.value)}` : name;
    }

    case 'JSXExpressionContainer':
      return `{${print(node.expression)}}`;

    case 'JSXText':
      return node.value ?? node.raw ?? '';

    case 'JSXSpreadAttribute':
      return `{...${print(node.argument)}}`;

    case 'JSXFragment': {
      const children = (node.children ?? []).map(print).join('');
      return `<>${children}</>`;
    }

    // ── Glimmer nodes (Ember templates) ────────────────────────────
    case 'GlimmerTemplate': {
      const children = (node.body ?? node.children ?? []).map(print).join('');
      return `<template>${children}</template>`;
    }

    case 'GlimmerElementNode': {
      const tag = node.tag ?? '';
      const attrs = (node.attributes ?? []).map(print).join(' ');
      const modifiers = (node.modifiers ?? []).map(print).join(' ');
      const children = (node.children ?? []).map(print).join('');
      const parts = [tag];
      if (attrs) parts.push(attrs);
      if (modifiers) parts.push(modifiers);
      if (node.selfClosing) return `<${parts.join(' ')} />`;
      return `<${parts.join(' ')}>${children}</${tag}>`;
    }

    case 'GlimmerTextNode':
      return node.chars ?? '';

    case 'GlimmerMustacheStatement': {
      const path = print(node.path);
      const params = (node.params ?? []).map(print).join(' ');
      const hash = node.hash ? print(node.hash) : '';
      const parts = [path];
      if (params) parts.push(params);
      if (hash) parts.push(hash);
      return `{{${parts.join(' ')}}}`;
    }

    case 'GlimmerBlockStatement': {
      const path = print(node.path);
      const params = (node.params ?? []).map(print).join(' ');
      const hash = node.hash ? print(node.hash) : '';
      const body = (node.body ?? node.program?.body ?? []).map(print).join('');
      const inverse = node.inverse
        ? `{{else}}${(node.inverse.body ?? []).map(print).join('')}`
        : '';
      const parts = [path];
      if (params) parts.push(params);
      if (hash) parts.push(hash);
      return `{{#${parts.join(' ')}}}${body}${inverse}{{/${print(node.path)}}}`;
    }

    case 'GlimmerPathExpression':
      return node.original ?? (node.parts ?? []).join('.');

    case 'GlimmerSubExpression': {
      const path = print(node.path);
      const params = (node.params ?? []).map(print).join(' ');
      const hash = node.hash ? print(node.hash) : '';
      const parts = [path];
      if (params) parts.push(params);
      if (hash) parts.push(hash);
      return `(${parts.join(' ')})`;
    }

    case 'GlimmerAttrNode': {
      const name = node.name ?? '';
      const value = print(node.value);
      return `${name}=${value}`;
    }

    case 'GlimmerConcatStatement': {
      const parts = (node.parts ?? []).map(print).join('');
      return `"${parts}"`;
    }

    case 'GlimmerHash': {
      const pairs = (node.pairs ?? []).map(print).join(' ');
      return pairs;
    }

    case 'GlimmerHashPair':
      return `${node.key}=${print(node.value)}`;

    case 'GlimmerStringLiteral':
      return `"${node.value ?? ''}"`;

    case 'GlimmerBooleanLiteral':
      return String(node.value);

    case 'GlimmerNumberLiteral':
      return String(node.value);

    case 'GlimmerNullLiteral':
      return 'null';

    case 'GlimmerUndefinedLiteral':
      return 'undefined';

    case 'GlimmerCommentStatement':
      return `{{!-- ${node.value ?? ''} --}}`;

    case 'GlimmerMustacheCommentStatement':
      return `{{! ${node.value ?? ''} }}`;

    case 'GlimmerElementModifierStatement': {
      const path = print(node.path);
      const params = (node.params ?? []).map(print).join(' ');
      const hash = node.hash ? print(node.hash) : '';
      const parts = [path];
      if (params) parts.push(params);
      if (hash) parts.push(hash);
      return `{{${parts.join(' ')}}}`;
    }

    case 'GlimmerProgram': {
      return (node.body ?? []).map(print).join('');
    }

    // ── Program (root) ─────────────────────────────────────────────
    case 'Program':
      return (node.body ?? []).map(print).join('\n');

    default:
      // For unknown node types, try common patterns
      if (node.name) return node.name;
      if (node.value != null) return String(node.value);
      if (node.raw) return node.raw;
      return '';
  }
}

module.exports = { print };
