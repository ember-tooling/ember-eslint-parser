const fs = require('node:fs');
const { transformForLint } = require('./transforms');
const { replaceRange } = require('./transforms');

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched;

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
  const tsPath = require.resolve('typescript', { paths: [parserPath] });
  const ts = require(tsPath);
  typescriptParser = require('@typescript-eslint/parser');
  patchTs = function patchTs() {
    if (isPatched) {
      return;
    }
    isPatched = true;
    const sys = { ...ts.sys };
    const newSys = {
      ...ts.sys,
      readDirectory(...args) {
        const results = sys.readDirectory.call(this, ...args);
        return [
          ...results,
          ...results.filter((x) => x.endsWith('.gts')).map((f) => f.replace(/\.gts$/, '.mts')),
        ];
      },
      fileExists(fileName) {
        return fs.existsSync(fileName.replace(/\.m?ts$/, '.gts')) || fs.existsSync(fileName);
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
          fileName = fileName.replace(/\.m?ts$/, '.gts');
          content = fs.readFileSync(fileName).toString();
        }
        if (fileName.endsWith('.gts')) {
          try {
            content = transformForLint(content).output;
          } catch (e) {
            console.error('failed to transformForLint for gts processing');
            console.error(e);
          }
        }
        if (
          (!fileName.endsWith('.d.ts') && fileName.endsWith('.ts')) ||
          fileName.endsWith('.gts')
        ) {
          try {
            content = replaceExtensions(content);
          } catch (e) {
            console.error('failed to replace extensions for gts processing');
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
    for (const b of sourceFile.statements) {
      if (b.kind === ts.SyntaxKind.ImportDeclaration && b.moduleSpecifier.text.endsWith('.gts')) {
        const value = b.moduleSpecifier.text.replace(/\.gts$/, '.mts');
        jsCode = replaceRange(jsCode, b.moduleSpecifier.pos + 2, b.moduleSpecifier.end - 1, value);
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
    for (const sourceFile of sourceFiles) {
      // check for deleted gts files, need to remove mts as well
      if (sourceFile.path.match(/\.m?ts$/) && sourceFile.isVirtualGts) {
        const gtsFile = program.getSourceFile(sourceFile.path.replace(/\.m?ts$/, '.gts'));
        if (!gtsFile) {
          sourceFile.version = null;
        }
      }
      if (sourceFile.path.endsWith('.gts')) {
        /**
         * @type {ts.SourceFile}
         */
        let mtsSourceFile = program.getSourceFile(sourceFile.path.replace(/\.gts$/, '.mts'));
        if (!mtsSourceFile) {
          mtsSourceFile = program.getSourceFile(sourceFile.path.replace(/\.gts$/, '.ts'));
        }
        if (mtsSourceFile) {
          const keep = {
            fileName: mtsSourceFile.fileName,
            path: mtsSourceFile.path,
            originalFileName: mtsSourceFile.originalFileName,
            resolvedPath: mtsSourceFile.resolvedPath,
            impliedNodeFormat: mtsSourceFile.impliedNodeFormat,
          };
          Object.assign(mtsSourceFile, sourceFile, keep);
          mtsSourceFile.isVirtualGts = true;
        }
      }
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
