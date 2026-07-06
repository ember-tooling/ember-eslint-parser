import fs from 'node:fs';
import { createRequire } from 'node:module';
import { transformForLint, replaceRange } from './transforms.js';

const require = createRequire(import.meta.url);

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched;

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
  const tsPath = require.resolve('typescript', { paths: [parserPath] });
  const ts = require(tsPath);
  typescriptParser = require('@typescript-eslint/parser');
  patchTs = function patchTs() {
    if (isPatched) return;
    isPatched = true;
    const sys = { ...ts.sys };
    const newSys = {
      ...ts.sys,
      readDirectory(...args) {
        const results = sys.readDirectory.call(this, ...args);
        const gtsVirtuals = results
          .filter((x) => x.endsWith('.gts'))
          .map((f) => f.replace(/\.gts$/, '.mts'));
        const gjsVirtuals = results
          .filter((x) => x.endsWith('.gjs'))
          .map((f) => f.replace(/\.gjs$/, '.mjs'));
        return results.concat(gtsVirtuals, gjsVirtuals);
      },
      fileExists(fileName) {
        const gtsExists = fs.existsSync(fileName.replace(/\.m?ts$/, '.gts'));
        const gjsExists = fs.existsSync(fileName.replace(/\.m?js$/, '.gjs'));
        return gtsExists || gjsExists || fs.existsSync(fileName);
      },
      readFile(fname) {
        let fileName = fname;
        let content = '';
        if (fileName.endsWith('tsconfig.tsbuildinfo')) {
          return content;
        }

        try {
          content = fs.readFileSync(fileName).toString();
        } catch {
          if (fileName.match(/\.m?ts$/)) {
            fileName = fileName.replace(/\.m?ts$/, '.gts');
          } else if (fileName.match(/\.m?js$/)) {
            fileName = fileName.replace(/\.m?js$/, '.gjs');
          }
          content = fs.readFileSync(fileName).toString();
        }
        if (fileName.endsWith('.gts') || fileName.endsWith('.gjs')) {
          try {
            content = transformForLint(content).output;
          } catch (e) {
            console.error('failed to transformForLint for gts/gjs processing');
            console.error(e);
          }
        }
        if (
          (!fileName.endsWith('.d.ts') && fileName.endsWith('.ts')) ||
          fileName.endsWith('.gts') ||
          fileName.endsWith('.gjs')
        ) {
          try {
            content = replaceExtensions(content);
          } catch (e) {
            console.error('failed to replace extensions for gts/gjs processing');
            console.error(e);
          }
        }
        return content;
      },
    };
    ts.setSys(newSys);
  };

  replaceExtensions = function replaceExtensions(code) {
    let jsCode = code;
    const sourceFile = ts.createSourceFile('__x__.ts', code, ts.ScriptTarget.Latest);
    const length = jsCode.length;
    function visit(node) {
      if (
        (node.kind === ts.SyntaxKind.ImportDeclaration ||
          node.kind === ts.SyntaxKind.ExportDeclaration) &&
        node.moduleSpecifier &&
        node.moduleSpecifier.text &&
        node.moduleSpecifier.text.endsWith('.gts')
      ) {
        const value = node.moduleSpecifier.text.replace(/\.gts$/, '.mts');
        jsCode = replaceRange(
          jsCode,
          node.moduleSpecifier.pos + 2,
          node.moduleSpecifier.end - 1,
          value
        );
      }
      if (
        node.kind === ts.SyntaxKind.CallExpression &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const arg = node.arguments[0];
        if (arg && arg.kind === ts.SyntaxKind.StringLiteral && arg.text.endsWith('.gts')) {
          const value = arg.text.replace(/\.gts$/, '.mts');
          jsCode = replaceRange(jsCode, arg.getStart(sourceFile) + 1, arg.end - 1, value); // +1/-1 to skip surrounding quotes
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    if (length !== jsCode.length) {
      throw new Error('bad replacement');
    }
    return jsCode;
  };

  /**
   * Graft each real `.gts`/`.gjs` SourceFile onto its virtual twins so every
   * import path yields the same AST nodes, and therefore the same type
   * identity. A program can hold up to three copies of one templated file:
   * the `.gts` root itself, the `.mts` twin injected via readDirectory (the
   * target of explicit `import './x.gts'` specifiers, which
   * replaceExtensions rewrites to `.mts`), and a `.ts` virtual created when
   * another file resolves an extensionless `import './x'` through the
   * patched fileExists. Distinct copies mean distinct class symbols — a
   * class with a private member is then not assignable to itself across
   * paths, unions of the "same" type don't dedupe, and typed rules
   * (`no-unnecessary-type-assertion`, `no-redundant-type-constituents`)
   * report order-dependent false positives (#229).
   *
   * Runs once per program: the graft mutates SourceFiles, so repeating it
   * after every parse rewrites binder state (symbol/locals) under a live
   * type checker — stale symbols stay cached and results become
   * lint-order dependent. It also walks the whole file list, which is
   * O(program files) per linted file.
   *
   * @param program {ts.Program}
   */
  const syncedPrograms = new WeakSet();
  syncMtsGtsSourceFiles = function syncMtsGtsSourceFiles(program) {
    if (syncedPrograms.has(program)) return;
    syncedPrograms.add(program);
    const sourceFiles = program.getSourceFiles();
    function syncVirtualFile(sourceFile, ext, virtualExt, virtualFlag) {
      // check for deleted files, need to remove virtual as well
      if (sourceFile.path.match(new RegExp(`\\.m?${virtualExt}$`)) && sourceFile[virtualFlag]) {
        const origFile = program.getSourceFile(
          sourceFile.path.replace(new RegExp(`\\.m?${virtualExt}$`), `.${ext}`)
        );
        if (!origFile) {
          sourceFile.version = null;
        }
      }
      if (sourceFile.path.endsWith(`.${ext}`)) {
        const virtualSourceFiles = [
          program.getSourceFile(
            sourceFile.path.replace(new RegExp(`\\.${ext}$`), `.${virtualExt}`)
          ),
          program.getSourceFile(
            sourceFile.path.replace(new RegExp(`\\.${ext}$`), virtualExt === 'mts' ? '.ts' : '.js')
          ),
        ].filter(Boolean);
        for (const virtualSourceFile of virtualSourceFiles) {
          const keep = {
            fileName: virtualSourceFile.fileName,
            path: virtualSourceFile.path,
            originalFileName: virtualSourceFile.originalFileName,
            resolvedPath: virtualSourceFile.resolvedPath,
            impliedNodeFormat: virtualSourceFile.impliedNodeFormat,
          };
          Object.assign(virtualSourceFile, sourceFile, keep);
          virtualSourceFile[virtualFlag] = true;
        }
      }
    }
    for (const sourceFile of sourceFiles) {
      syncVirtualFile(sourceFile, 'gts', 'mts', 'isVirtualGts');
      syncVirtualFile(sourceFile, 'gjs', 'mjs', 'isVirtualGjs');
    }
  };
} catch /* istanbul ignore next */ {
  // typescript not available
  patchTs = () => null;
  replaceExtensions = (code) => code;
  syncMtsGtsSourceFiles = () => null;
}

export { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser };
