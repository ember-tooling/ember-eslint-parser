'use strict';

/**
 * Recursive AST printer that handles ESTree, TypeScript, JSX, and
 * Glimmer template node types.
 *
 * Tools like zmod use span-based patching (preserving the original source
 * for unchanged regions), so this printer is typically only invoked for
 * newly-created AST nodes (via builders).
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
      return printTypeAnnotated(node.name, node);

    case 'PrivateIdentifier':
      return `#${node.name}`;

    case 'Literal':
    case 'StringLiteral':
      if (typeof node.value === 'string') {
        const raw = node.extra?.raw ?? node.raw;
        const quote = raw && (raw[0] === "'" || raw[0] === '"' || raw[0] === '`') ? raw[0] : '"';
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
      const typeArgs = node.typeParameters ? print(node.typeParameters) : '';
      const args = (node.arguments ?? []).map(print).join(', ');
      const opt = node.optional ? '?.' : '';
      return `${callee}${opt}${typeArgs}(${args})`;
    }

    case 'MemberExpression':
    case 'OptionalMemberExpression': {
      const obj = print(node.object);
      const prop = print(node.property);
      if (node.computed) return `${obj}[${prop}]`;
      const opt = node.optional ? '?.' : '.';
      return `${obj}${opt}${prop}`;
    }

    case 'ChainExpression':
      return print(node.expression);

    case 'ArrowFunctionExpression': {
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      const body = print(node.body);
      const async = node.async ? 'async ' : '';
      return `${async}${typeParams}(${params})${returnType} => ${body}`;
    }

    case 'FunctionExpression': {
      const id = node.id ? ' ' + print(node.id) : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      const body = print(node.body);
      const async = node.async ? 'async ' : '';
      const gen = node.generator ? '*' : '';
      return `${async}function${gen}${id}${typeParams}(${params})${returnType} ${body}`;
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
    case 'ExperimentalSpreadProperty':
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
      const typeArgs = node.typeParameters ? print(node.typeParameters) : '';
      const args = (node.arguments ?? []).map(print).join(', ');
      return `new ${callee}${typeArgs}(${args})`;
    }

    case 'ThisExpression':
      return 'this';

    case 'Super':
      return 'super';

    case 'MetaProperty':
      return `${print(node.meta)}.${print(node.property)}`;

    case 'ImportExpression': {
      const source = print(node.source);
      return `import(${source})`;
    }

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
    case 'ExperimentalRestProperty':
      return `...${print(node.argument)}`;

    case 'AssignmentPattern':
      return `${print(node.left)} = ${print(node.right)}`;

    // ── Statements ─────────────────────────────────────────────────
    case 'ExpressionStatement':
      return print(node.expression) + ';';

    case 'BlockStatement':
    case 'StaticBlock': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'EmptyStatement':
      return ';';

    case 'DebuggerStatement':
      return 'debugger;';

    case 'ReturnStatement':
      return node.argument ? `return ${print(node.argument)};` : 'return;';

    case 'BreakStatement':
      return node.label ? `break ${print(node.label)};` : 'break;';

    case 'ContinueStatement':
      return node.label ? `continue ${print(node.label)};` : 'continue;';

    case 'LabeledStatement':
      return `${print(node.label)}: ${print(node.body)}`;

    case 'VariableDeclaration': {
      const decls = (node.declarations ?? []).map(print).join(', ');
      const declare = node.declare ? 'declare ' : '';
      return `${declare}${node.kind} ${decls};`;
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

    case 'SwitchStatement': {
      const disc = print(node.discriminant);
      const cases = (node.cases ?? []).map(print).join('\n');
      return `switch (${disc}) {\n${cases}\n}`;
    }

    case 'SwitchCase': {
      const test = node.test ? `case ${print(node.test)}:` : 'default:';
      const body = (node.consequent ?? []).map(print).join('\n');
      return `${test}\n${body}`;
    }

    case 'ThrowStatement':
      return `throw ${print(node.argument)};`;

    case 'TryStatement': {
      let result = `try ${print(node.block)}`;
      if (node.handler) result += ` ${print(node.handler)}`;
      if (node.finalizer) result += ` finally ${print(node.finalizer)}`;
      return result;
    }

    case 'CatchClause': {
      const param = node.param ? `(${print(node.param)})` : '';
      return `catch${param ? ' ' + param : ''} ${print(node.body)}`;
    }

    case 'WhileStatement':
      return `while (${print(node.test)}) ${print(node.body)}`;

    case 'DoWhileStatement':
      return `do ${print(node.body)} while (${print(node.test)});`;

    case 'ForStatement': {
      const init = node.init ? print(node.init).replace(/;$/, '') : '';
      const test = node.test ? print(node.test) : '';
      const update = node.update ? print(node.update) : '';
      return `for (${init}; ${test}; ${update}) ${print(node.body)}`;
    }

    case 'ForInStatement':
      return `for (${print(node.left)} in ${print(node.right)}) ${print(node.body)}`;

    case 'ForOfStatement': {
      const aw = node.await ? 'await ' : '';
      return `for ${aw}(${print(node.left)} of ${print(node.right)}) ${print(node.body)}`;
    }

    case 'WithStatement':
      return `with (${print(node.object)}) ${print(node.body)}`;

    // ── Declarations ───────────────────────────────────────────────
    case 'FunctionDeclaration':
    case 'TSDeclareFunction': {
      const id = node.id ? print(node.id) : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      const body = node.body ? ' ' + print(node.body) : ';';
      const async = node.async ? 'async ' : '';
      const gen = node.generator ? '*' : '';
      const declare = node.declare ? 'declare ' : '';
      return `${declare}${async}function${gen} ${id}${typeParams}(${params})${returnType}${body}`;
    }

    case 'ClassDeclaration':
    case 'ClassExpression': {
      const decorators = (node.decorators ?? []).map(print).join('\n');
      const prefix = decorators ? decorators + '\n' : '';
      const declare = node.declare ? 'declare ' : '';
      const abstract = node.abstract ? 'abstract ' : '';
      const id = node.id ? ` ${print(node.id)}` : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const superClass = node.superClass ? ` extends ${print(node.superClass)}` : '';
      const superTypeParams = node.superTypeParameters ? print(node.superTypeParameters) : '';
      const impls = (node.implements ?? []).map(print);
      const implStr = impls.length ? ` implements ${impls.join(', ')}` : '';
      const body = print(node.body);
      return `${prefix}${declare}${abstract}class${id}${typeParams}${superClass}${superTypeParams}${implStr} ${body}`;
    }

    case 'ClassBody': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'MethodDefinition':
    case 'TSAbstractMethodDefinition': {
      const decorators = (node.decorators ?? []).map(print).join('\n');
      const prefix = decorators ? decorators + '\n' : '';
      const key = print(node.key);
      const value = node.value;
      const typeParams = value?.typeParameters ? print(value.typeParameters) : '';
      const params = (value?.params ?? []).map(print).join(', ');
      const returnType = value?.returnType ? print(value.returnType) : '';
      const body = value?.body ? ' ' + print(value.body) : ';';
      const staticKw = node.static ? 'static ' : '';
      const kind = node.kind === 'get' ? 'get ' : node.kind === 'set' ? 'set ' : '';
      const accessibility = node.accessibility ? node.accessibility + ' ' : '';
      const override = node.override ? 'override ' : '';
      const abstract = node.type === 'TSAbstractMethodDefinition' ? 'abstract ' : '';
      return `${prefix}${accessibility}${abstract}${override}${staticKw}${kind}${key}${typeParams}(${params})${returnType}${body}`;
    }

    case 'PropertyDefinition':
    case 'AccessorProperty':
    case 'TSAbstractPropertyDefinition':
    case 'TSAbstractAccessorProperty': {
      const decorators = (node.decorators ?? []).map(print).join('\n');
      const prefix = decorators ? decorators + '\n' : '';
      const key = print(node.key);
      const staticKw = node.static ? 'static ' : '';
      const accessibility = node.accessibility ? node.accessibility + ' ' : '';
      const override = node.override ? 'override ' : '';
      const readonly = node.readonly ? 'readonly ' : '';
      const abstract = node.type.startsWith('TSAbstract') ? 'abstract ' : '';
      const accessor = node.type.includes('Accessor') ? 'accessor ' : '';
      const typeAnnotation = node.typeAnnotation ? print(node.typeAnnotation) : '';
      const init = node.value ? ` = ${print(node.value)}` : '';
      return `${prefix}${accessibility}${abstract}${override}${staticKw}${readonly}${accessor}${key}${typeAnnotation}${init};`;
    }

    case 'Decorator':
      return `@${print(node.expression)}`;

    // ── Imports/Exports ────────────────────────────────────────────
    case 'ImportDeclaration': {
      const specs = (node.specifiers ?? []).map(print);
      const source = print(node.source);
      const attrs = (node.attributes ?? []).map(print);
      const attrStr = attrs.length ? ` with { ${attrs.join(', ')} }` : '';
      if (specs.length === 0) return `import ${source}${attrStr};`;
      const defaultSpec = specs.find(
        (_, i) => node.specifiers[i].type === 'ImportDefaultSpecifier'
      );
      const nsSpec = node.specifiers.find((s) => s.type === 'ImportNamespaceSpecifier');
      const namedSpecs = node.specifiers
        .filter((s) => s.type === 'ImportSpecifier')
        .map(print);
      const parts = [];
      if (defaultSpec) parts.push(defaultSpec);
      if (nsSpec) parts.push(print(nsSpec));
      if (namedSpecs.length) parts.push(`{ ${namedSpecs.join(', ')} }`);
      return `import ${parts.join(', ')} from ${source}${attrStr};`;
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

    case 'ImportExpression': {
      const source = print(node.source);
      return `import(${source})`;
    }

    case 'ImportAttribute':
      return `${print(node.key)}: ${print(node.value)}`;

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

    case 'ExportAllDeclaration': {
      const exported = node.exported ? ` as ${print(node.exported)}` : '';
      return `export *${exported} from ${print(node.source)};`;
    }

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

    case 'JSXOpeningFragment':
      return '<>';

    case 'JSXClosingFragment':
      return '</>';

    case 'JSXIdentifier':
      return node.name;

    case 'JSXNamespacedName':
      return `${print(node.namespace)}:${print(node.name)}`;

    case 'JSXMemberExpression':
      return `${print(node.object)}.${print(node.property)}`;

    case 'JSXAttribute': {
      const name = print(node.name);
      return node.value ? `${name}=${print(node.value)}` : name;
    }

    case 'JSXExpressionContainer':
      return `{${print(node.expression)}}`;

    case 'JSXEmptyExpression':
      return '';

    case 'JSXText':
      return node.value ?? node.raw ?? '';

    case 'JSXSpreadAttribute':
      return `{...${print(node.argument)}}`;

    case 'JSXSpreadChild':
      return `{...${print(node.expression)}}`;

    case 'JSXFragment': {
      const children = (node.children ?? []).map(print).join('');
      return `<>${children}</>`;
    }

    // ── TypeScript: type keywords ──────────────────────────────────
    case 'TSAnyKeyword':
      return 'any';
    case 'TSBigIntKeyword':
      return 'bigint';
    case 'TSBooleanKeyword':
      return 'boolean';
    case 'TSIntrinsicKeyword':
      return 'intrinsic';
    case 'TSNeverKeyword':
      return 'never';
    case 'TSNullKeyword':
      return 'null';
    case 'TSNumberKeyword':
      return 'number';
    case 'TSObjectKeyword':
      return 'object';
    case 'TSStringKeyword':
      return 'string';
    case 'TSSymbolKeyword':
      return 'symbol';
    case 'TSUndefinedKeyword':
      return 'undefined';
    case 'TSUnknownKeyword':
      return 'unknown';
    case 'TSVoidKeyword':
      return 'void';
    case 'TSThisType':
      return 'this';

    // ── TypeScript: modifier keywords ──────────────────────────────
    case 'TSAbstractKeyword':
      return 'abstract';
    case 'TSAsyncKeyword':
      return 'async';
    case 'TSDeclareKeyword':
      return 'declare';
    case 'TSExportKeyword':
      return 'export';
    case 'TSPrivateKeyword':
      return 'private';
    case 'TSProtectedKeyword':
      return 'protected';
    case 'TSPublicKeyword':
      return 'public';
    case 'TSReadonlyKeyword':
      return 'readonly';
    case 'TSStaticKeyword':
      return 'static';

    // ── TypeScript: type annotations & references ──────────────────
    case 'TSTypeAnnotation':
      return `: ${print(node.typeAnnotation)}`;

    case 'TSTypeReference': {
      const name = print(node.typeName);
      const params = node.typeParameters ? print(node.typeParameters) : '';
      return `${name}${params}`;
    }

    case 'TSQualifiedName':
      return `${print(node.left)}.${print(node.right)}`;

    case 'TSTypeParameterDeclaration':
    case 'TSTypeParameterInstantiation': {
      const params = (node.params ?? []).map(print).join(', ');
      return `<${params}>`;
    }

    case 'TSTypeParameter': {
      const name = typeof node.name === 'string' ? node.name : print(node.name);
      const constraint = node.constraint ? ` extends ${print(node.constraint)}` : '';
      const def = node.default ? ` = ${print(node.default)}` : '';
      const inKw = node.in ? 'in ' : '';
      const outKw = node.out ? 'out ' : '';
      const constKw = node.const ? 'const ' : '';
      return `${constKw}${inKw}${outKw}${name}${constraint}${def}`;
    }

    // ── TypeScript: type operators & combinators ───────────────────
    case 'TSUnionType':
      return (node.types ?? []).map(print).join(' | ');

    case 'TSIntersectionType':
      return (node.types ?? []).map(print).join(' & ');

    case 'TSArrayType':
      return `${print(node.elementType)}[]`;

    case 'TSTupleType': {
      const elems = (node.elementTypes ?? []).map(print).join(', ');
      return `[${elems}]`;
    }

    case 'TSNamedTupleMember': {
      const label = print(node.label);
      const optional = node.optional ? '?' : '';
      return `${label}${optional}: ${print(node.elementType)}`;
    }

    case 'TSOptionalType':
      return `${print(node.typeAnnotation)}?`;

    case 'TSRestType':
      return `...${print(node.typeAnnotation)}`;

    case 'TSTypeOperator': {
      const op = node.operator ?? '';
      return `${op} ${print(node.typeAnnotation)}`;
    }

    case 'TSIndexedAccessType':
      return `${print(node.objectType)}[${print(node.indexType)}]`;

    case 'TSConditionalType':
      return `${print(node.checkType)} extends ${print(node.extendsType)} ? ${print(node.trueType)} : ${print(node.falseType)}`;

    case 'TSInferType':
      return `infer ${print(node.typeParameter)}`;

    case 'TSLiteralType':
      return print(node.literal);

    case 'TSTemplateLiteralType': {
      const quasis = node.quasis ?? [];
      const types = node.types ?? [];
      let result = '`';
      for (let i = 0; i < quasis.length; i++) {
        result += quasis[i].value?.raw ?? quasis[i].value?.cooked ?? '';
        if (i < types.length) {
          result += '${' + print(types[i]) + '}';
        }
      }
      return result + '`';
    }

    // ── TypeScript: function & constructor types ───────────────────
    case 'TSFunctionType':
    case 'TSConstructorType': {
      const newKw = node.type === 'TSConstructorType' ? 'new ' : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      return `${newKw}${typeParams}(${params}) => ${returnType.replace(/^: /, '')}`;
    }

    case 'TSCallSignatureDeclaration':
    case 'TSConstructSignatureDeclaration': {
      const newKw = node.type === 'TSConstructSignatureDeclaration' ? 'new ' : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      return `${newKw}${typeParams}(${params})${returnType};`;
    }

    // ── TypeScript: object types & signatures ──────────────────────
    case 'TSTypeLiteral': {
      const members = (node.members ?? []).map(print).join('\n');
      return `{\n${members}\n}`;
    }

    case 'TSPropertySignature': {
      const readonly = node.readonly ? 'readonly ' : '';
      const computed = node.computed ? `[${print(node.key)}]` : print(node.key);
      const optional = node.optional ? '?' : '';
      const typeAnnotation = node.typeAnnotation ? print(node.typeAnnotation) : '';
      return `${readonly}${computed}${optional}${typeAnnotation};`;
    }

    case 'TSMethodSignature': {
      const computed = node.computed ? `[${print(node.key)}]` : print(node.key);
      const optional = node.optional ? '?' : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      return `${computed}${optional}${typeParams}(${params})${returnType};`;
    }

    case 'TSIndexSignature': {
      const params = (node.parameters ?? []).map(print).join(', ');
      const typeAnnotation = node.typeAnnotation ? print(node.typeAnnotation) : '';
      const readonly = node.readonly ? 'readonly ' : '';
      return `${readonly}[${params}]${typeAnnotation};`;
    }

    case 'TSMappedType': {
      const readonly = node.readonly === true ? 'readonly ' : node.readonly === '+' ? '+readonly ' : node.readonly === '-' ? '-readonly ' : '';
      const param = print(node.typeParameter);
      const nameType = node.nameType ? ` as ${print(node.nameType)}` : '';
      const optional = node.optional === true ? '?' : node.optional === '+' ? '+?' : node.optional === '-' ? '-?' : '';
      const typeAnnotation = node.typeAnnotation ? `: ${print(node.typeAnnotation)}` : '';
      return `{ ${readonly}[${param}${nameType}]${optional}${typeAnnotation} }`;
    }

    // ── TypeScript: declarations ───────────────────────────────────
    case 'TSInterfaceDeclaration': {
      const declare = node.declare ? 'declare ' : '';
      const id = print(node.id);
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const ext = (node.extends ?? []).map(print);
      const extStr = ext.length ? ` extends ${ext.join(', ')}` : '';
      const body = print(node.body);
      return `${declare}interface ${id}${typeParams}${extStr} ${body}`;
    }

    case 'TSInterfaceBody': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'TSInterfaceHeritage':
    case 'TSClassImplements': {
      const expr = print(node.expression);
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      return `${expr}${typeParams}`;
    }

    case 'TSTypeAliasDeclaration': {
      const declare = node.declare ? 'declare ' : '';
      const id = print(node.id);
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      return `${declare}type ${id}${typeParams} = ${print(node.typeAnnotation)};`;
    }

    case 'TSEnumDeclaration': {
      const declare = node.declare ? 'declare ' : '';
      const constKw = node.const ? 'const ' : '';
      const id = print(node.id);
      const members = (node.members ?? []).map(print).join(',\n');
      return `${declare}${constKw}enum ${id} {\n${members}\n}`;
    }

    case 'TSEnumMember': {
      const id = print(node.id);
      return node.initializer ? `${id} = ${print(node.initializer)}` : id;
    }

    case 'TSModuleDeclaration': {
      const declare = node.declare ? 'declare ' : '';
      const kind = node.kind === 'global' ? 'global' : `${node.kind ?? 'module'} ${print(node.id)}`;
      const body = node.body ? ` ${print(node.body)}` : '';
      return `${declare}${kind}${body}`;
    }

    case 'TSModuleBlock': {
      const body = (node.body ?? []).map(print).join('\n');
      return `{\n${body}\n}`;
    }

    case 'TSNamespaceExportDeclaration':
      return `export as namespace ${print(node.id)};`;

    // ── TypeScript: expressions & assertions ───────────────────────
    case 'TSAsExpression':
      return `${print(node.expression)} as ${print(node.typeAnnotation)}`;

    case 'TSSatisfiesExpression':
      return `${print(node.expression)} satisfies ${print(node.typeAnnotation)}`;

    case 'TSTypeAssertion':
      return `<${print(node.typeAnnotation)}>${print(node.expression)}`;

    case 'TSNonNullExpression':
      return `${print(node.expression)}!`;

    case 'TSInstantiationExpression': {
      const expr = print(node.expression);
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      return `${expr}${typeParams}`;
    }

    // ── TypeScript: imports & exports ──────────────────────────────
    case 'TSImportEqualsDeclaration': {
      const id = print(node.id);
      const ref = print(node.moduleReference);
      return `import ${id} = ${ref};`;
    }

    case 'TSExternalModuleReference':
      return `require(${print(node.expression)})`;

    case 'TSExportAssignment':
      return `export = ${print(node.expression)};`;

    case 'TSImportType': {
      const arg = print(node.parameter);
      const qualifier = node.qualifier ? `.${print(node.qualifier)}` : '';
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      return `import(${arg})${qualifier}${typeParams}`;
    }

    // ── TypeScript: parameter & type modifiers ─────────────────────
    case 'TSParameterProperty': {
      const accessibility = node.accessibility ? node.accessibility + ' ' : '';
      const readonly = node.readonly ? 'readonly ' : '';
      const override = node.override ? 'override ' : '';
      return `${accessibility}${override}${readonly}${print(node.parameter)}`;
    }

    case 'TSTypePredicate': {
      const asserts = node.asserts ? 'asserts ' : '';
      const name = print(node.parameterName);
      const type = node.typeAnnotation ? ` is ${print(node.typeAnnotation).replace(/^: /, '')}` : '';
      return `${asserts}${name}${type}`;
    }

    case 'TSTypeQuery': {
      const name = print(node.exprName);
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      return `typeof ${name}${typeParams}`;
    }

    case 'TSEmptyBodyFunctionExpression': {
      const typeParams = node.typeParameters ? print(node.typeParameters) : '';
      const params = (node.params ?? []).map(print).join(', ');
      const returnType = node.returnType ? print(node.returnType) : '';
      return `${typeParams}(${params})${returnType}`;
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

    case 'GlimmerElementNodePart':
      return node.original ?? node.name ?? '';

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

    case 'GlimmerBlock':
    case 'GlimmerProgram': {
      return (node.body ?? []).map(print).join('');
    }

    // ── Program (root) ─────────────────────────────────────────────
    case 'Program':
      return (node.body ?? []).map(print).join('\n');

    default:
      throw new Error(`ember-eslint-parser print: unsupported node type '${node.type}'`);
  }
}

/**
 * Prints an identifier with an optional TS type annotation.
 * @param {string} name
 * @param {object} node
 * @return {string}
 */
function printTypeAnnotated(name, node) {
  const optional = node.optional ? '?' : '';
  const typeAnnotation = node.typeAnnotation ? print(node.typeAnnotation) : '';
  return `${name}${optional}${typeAnnotation}`;
}

module.exports = { print };
