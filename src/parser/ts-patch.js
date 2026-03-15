import fs from 'node:fs';
import { createRequire } from 'node:module';
import { transformForLint, replaceRange } from './transforms.js';

const require = createRequire(import.meta.url);

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched, allowGjs;

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  const tsPath = require.resolve('typescript', { paths: [parserPath] });
  const ts = require(tsPath);
  typescriptParser = require('@typescript-eslint/parser');
  patchTs = function patchTs(options = {}) {
    if (isPatched) return { allowGjs };
    isPatched = true;
    allowGjs = options.allowGjs !== undefined ? options.allowGjs : true;
    const sys = { ...ts.sys };
    const newSys = {
      ...ts.sys,
      readDirectory(...args) {
        const results = sys.readDirectory.call(this, ...args);
        const gtsVirtuals = results
          .filter((x) => x.endsWith('.gts'))
          .map((f) => f.replace(/\.gts$/, '.mts'));
        const gjsVirtuals = allowGjs
          ? results.filter((x) => x.endsWith('.gjs')).map((f) => f.replace(/\.gjs$/, '.mjs'))
          : [];
        return results.concat(gtsVirtuals, gjsVirtuals);
      },
      fileExists(fileName) {
        const gtsExists = fs.existsSync(fileName.replace(/\.m?ts$/, '.gts'));
        const gjsExists = allowGjs ? fs.existsSync(fileName.replace(/\.m?js$/, '.gjs')) : false;
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
          } else if (allowGjs && fileName.match(/\.m?js$/)) {
            fileName = fileName.replace(/\.m?js$/, '.gjs');
          }
          content = fs.readFileSync(fileName).toString();
        }
        if (fileName.endsWith('.gts') || (allowGjs && fileName.endsWith('.gjs'))) {
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
          (allowGjs && fileName.endsWith('.gjs'))
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
    return { allowGjs };
  };

  replaceExtensions = function replaceExtensions(code) {
    let jsCode = code;
    const sourceFile = ts.createSourceFile('__x__.ts', code, ts.ScriptTarget.Latest);
    const length = jsCode.length;
    function visit(node) {
      if (
        node.kind === ts.SyntaxKind.ImportDeclaration &&
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
   *
   * @param program {ts.Program}
   */
  syncMtsGtsSourceFiles = function syncMtsGtsSourceFiles(program) {
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
        let virtualSourceFile = program.getSourceFile(
          sourceFile.path.replace(new RegExp(`\\.${ext}$`), `.${virtualExt}`)
        );
        if (!virtualSourceFile) {
          virtualSourceFile = program.getSourceFile(
            sourceFile.path.replace(new RegExp(`\\.${ext}$`), virtualExt === 'mts' ? '.ts' : '.js')
          );
        }
        if (virtualSourceFile) {
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
