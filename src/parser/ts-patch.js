const fs = require('node:fs');
const { transformForLint } = require('./transforms');
const { replaceRange } = require('./transforms');

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched, allowGjs;

/**
 * Helper function to find the first existing file among possible variants
 * @param {string} fileName - The original file name to resolve
 * @param {boolean} allowGjs - Whether .gjs files are allowed
 * @returns {string|null} - The first existing file path, or null if none exist
 */
function findExistingFile(fileName, allowGjs) {
  // Check .gts first
  const gtsFile = fileName.replace(/\.m?ts$/, '.gts');
  if (fs.existsSync(gtsFile)) return gtsFile;

  // Check .gjs (if allowed)
  if (allowGjs) {
    const gjsFile = fileName.replace(/\.m?js$/, '.gjs');
    if (fs.existsSync(gjsFile)) return gjsFile;

    // Check .gjs.d.ts (multiple patterns)
    const gjsDtsFile1 = fileName.replace(/\.mjs\.d\.ts$/, '.gjs.d.ts');
    const gjsDtsFile2 = fileName.replace(/\.d\.mts$/, '.gjs.d.ts');
    if (fs.existsSync(gjsDtsFile1)) return gjsDtsFile1;
    if (fs.existsSync(gjsDtsFile2)) return gjsDtsFile2;

    // Check .d.gjs.ts pattern
    const dGjsFile = fileName.replace(/\.d\.mts$/, '.d.gjs.ts');
    if (fs.existsSync(dGjsFile)) return dGjsFile;
  }

  // Check original file
  if (fs.existsSync(fileName)) return fileName;

  return null;
}

/**
 * Helper function to resolve the actual file path for reading
 * @param {string} fileName - The original file name to resolve
 * @param {boolean} allowGjs - Whether .gjs files are allowed
 * @returns {string} - The resolved file path to read from
 */
function resolveFileForReading(fileName, allowGjs) {
  // Handle declaration files first (more specific patterns)
  if (fileName.endsWith('.d.mts')) {
    // .d.mts files could map to .gjs declaration patterns
    if (allowGjs && fs.existsSync(fileName.replace(/\.d\.mts$/, '.d.gjs.ts'))) {
      return fileName.replace(/\.d\.mts$/, '.d.gjs.ts');
    } else if (allowGjs && fs.existsSync(fileName.replace(/\.d\.mts$/, '.gjs.d.ts'))) {
      return fileName.replace(/\.d\.mts$/, '.gjs.d.ts');
    }
  } else if (allowGjs && fileName.endsWith('.mjs.d.ts')) {
    return fileName.replace(/\.mjs\.d\.ts$/, '.gjs.d.ts');
  } else if (fileName.match(/\.m?ts$/) && !fileName.endsWith('.d.ts')) {
    return fileName.replace(/\.m?ts$/, '.gts');
  } else if (allowGjs && fileName.match(/\.m?js$/) && !fileName.endsWith('.d.ts')) {
    return fileName.replace(/\.m?js$/, '.gjs');
  }

  return fileName;
}

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
        return findExistingFile(fileName, allowGjs) !== null;
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
          fileName = resolveFileForReading(fileName, allowGjs);
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
