const fs = require('node:fs');
const { transformForLint } = require('./transforms');
const { replaceRange } = require('./transforms');

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched, allowGjs;

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
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
        // Map .gjs.d.ts to both .mjs.d.ts AND .d.mts patterns
        // Also handle .d.gjs.ts (allowArbitraryExtensions pattern for .gjs files)
        const gjsDtsVirtuals = allowGjs
          ? results
              .filter((x) => x.endsWith('.gjs.d.ts'))
              .flatMap((f) => [
                f.replace(/\.gjs\.d\.ts$/, '.mjs.d.ts'),
                f.replace(/\.gjs\.d\.ts$/, '.d.mts'),
              ])
          : [];
        // Handle .d.gjs.ts pattern (allowArbitraryExtensions for .gjs files only)
        const dGjsVirtuals = allowGjs
          ? results
              .filter((x) => x.endsWith('.d.gjs.ts'))
              .map((f) => f.replace(/\.d\.gjs\.ts$/, '.d.mts'))
          : [];
        return results.concat(gtsVirtuals, gjsVirtuals, gjsDtsVirtuals, dGjsVirtuals);
      },
      fileExists(fileName) {
        const gtsExists = fs.existsSync(fileName.replace(/\.m?ts$/, '.gts'));
        const gjsExists = allowGjs ? fs.existsSync(fileName.replace(/\.m?js$/, '.gjs')) : false;
        // Check for .gjs.d.ts files with multiple patterns
        const gjsDtsExists = allowGjs
          ? fs.existsSync(fileName.replace(/\.mjs\.d\.ts$/, '.gjs.d.ts')) ||
            fs.existsSync(fileName.replace(/\.d\.mts$/, '.gjs.d.ts'))
          : false;
        // Check for .d.gjs.ts pattern (allowArbitraryExtensions for .gjs files only)
        const dGjsExists = allowGjs
          ? fs.existsSync(fileName.replace(/\.d\.mts$/, '.d.gjs.ts'))
          : false;
        return gtsExists || gjsExists || gjsDtsExists || dGjsExists || fs.existsSync(fileName);
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
          // Handle declaration files first (more specific patterns)
          if (fileName.endsWith('.d.mts')) {
            // .d.mts files could map to .gjs declaration patterns
            if (allowGjs && fs.existsSync(fileName.replace(/\.d\.mts$/, '.d.gjs.ts'))) {
              fileName = fileName.replace(/\.d\.mts$/, '.d.gjs.ts');
            } else if (allowGjs && fs.existsSync(fileName.replace(/\.d\.mts$/, '.gjs.d.ts'))) {
              fileName = fileName.replace(/\.d\.mts$/, '.gjs.d.ts');
            }
          } else if (allowGjs && fileName.endsWith('.mjs.d.ts')) {
            fileName = fileName.replace(/\.mjs\.d\.ts$/, '.gjs.d.ts');
          } else if (fileName.match(/\.m?ts$/) && !fileName.endsWith('.d.ts')) {
            fileName = fileName.replace(/\.m?ts$/, '.gts');
          } else if (allowGjs && fileName.match(/\.m?js$/) && !fileName.endsWith('.d.ts')) {
            fileName = fileName.replace(/\.m?js$/, '.gjs');
          }
          content = fs.readFileSync(fileName).toString();
        }
        // Only transform template files, not declaration files
        if (
          (fileName.endsWith('.gts') && !fileName.endsWith('.d.ts')) ||
          (allowGjs && fileName.endsWith('.gjs') && !fileName.endsWith('.d.ts'))
        ) {
          try {
            content = transformForLint(content).output;
          } catch (e) {
            console.error('failed to transformForLint for gts/gjs processing');
            console.error(e);
          }
        }
        // Only replace extensions in non-declaration files
        if (
          (!fileName.endsWith('.d.ts') && fileName.endsWith('.ts')) ||
          (fileName.endsWith('.gts') && !fileName.endsWith('.d.ts')) ||
          (allowGjs && fileName.endsWith('.gjs') && !fileName.endsWith('.d.ts'))
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
    for (const b of sourceFile.statements) {
      if (b.kind === ts.SyntaxKind.ImportDeclaration) {
        if (b.moduleSpecifier.text.endsWith('.gts')) {
          const value = b.moduleSpecifier.text.replace(/\.gts$/, '.mts');
          jsCode = replaceRange(
            jsCode,
            b.moduleSpecifier.pos + 2,
            b.moduleSpecifier.end - 1,
            value
          );
        } else if (allowGjs && b.moduleSpecifier.text.endsWith('.gjs')) {
          const value = b.moduleSpecifier.text.replace(/\.gjs$/, '.mjs');
          jsCode = replaceRange(
            jsCode,
            b.moduleSpecifier.pos + 2,
            b.moduleSpecifier.end - 1,
            value
          );
        }
      }
    }
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

module.exports = {
  patchTs,
  replaceExtensions,
  syncMtsGtsSourceFiles,
  typescriptParser,
};
