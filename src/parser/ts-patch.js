import fs from 'node:fs';
import { createRequire } from 'node:module';
import { transformForLint, replaceRange } from './transforms.js';
import { warnOnProjectSizeLimitDemotion } from './size-limit-warning.js';

const require = createRequire(import.meta.url);

let patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser, isPatched;

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
  const tsPath = require.resolve('typescript', { paths: [parserPath] });
  const ts = require(tsPath);
  typescriptParser = require('@typescript-eslint/parser');

  // Installed at import rather than from patchTs(): typescript-eslint builds
  // its ProjectService on the first type-aware parse in the process, which is
  // whichever file ESLint reaches first. If that is a plain .ts file, the
  // project -- and the size decision that demotes it -- is already made before
  // this parser is ever asked for anything. This hook only observes, so there
  // is nothing to gate it on.
  warnOnProjectSizeLimitDemotion(ts);

  patchTs = function patchTs() {
    if (isPatched) return;
    isPatched = true;
    const sys = { ...ts.sys };
    const newSys = {
      ...ts.sys,
      // `.gts` is TypeScript with a template in it, but TypeScript has no way
      // to be told that. Its ProjectService charges every root it does not
      // recognise as TypeScript against `maxProgramSizeForNonTsFiles` (20MB)
      // and, past the limit, disables the project's language service — see
      // ./size-limit-warning.js for what that costs. `extraFileExtensions`
      // looks like the place to declare the truth, but an extension registered
      // as ScriptKind.TS is dropped from the supported set outright, so `.gts`
      // has to be registered Deferred and Deferred is counted.
      //
      // Until that is fixed upstream, the only lever left is the size itself:
      // report `.gts` as weightless and the project gets measured on the
      // JavaScript it actually contains. `.gjs` IS JavaScript, so it keeps its
      // weight — an app over the limit on .js + .gjs is still demoted, and the
      // warning above is what tells them so.
      //
      // The other reader of this value is ScriptInfo#getFileTextAndSize, which
      // skips loading the contents of non-TS files over 4MB. A `.gts` that big
      // will now be loaded rather than blanked, which is what a linter wants.
      ...(sys.getFileSize && {
        getFileSize(fileName) {
          if (fileName.endsWith('.gts')) return 0;
          return sys.getFileSize.call(this, fileName);
        },
      }),
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
        if (fileName.endsWith('.tsbuildinfo')) {
          // Incremental build state is optional and never a .gts/.gjs file, so
          // delegate to the real host: it returns the content when present and
          // reports a missing file as absent (undefined) instead of throwing.
          // The watch program reads `tsBuildInfoFile` without a fileExists
          // probe (readBuilderProgram -> host.readFile), so a fresh/cleaned
          // project with a custom buildinfo path (e.g.
          // "declarations/.tsbuildinfo") would otherwise abort linting of
          // every file with a Parsing error: ENOENT.
          return sys.readFile(fileName);
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

  // typescript-eslint copies `ts.sys` by value when it builds a program or
  // project service, on the first type-aware parse in the process — which may be
  // a plain .ts file that never reaches this parser. Patching at module load is
  // what puts the wrappers in that copy, and in the project's first file scan.
  patchTs();

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
            // The twin is a .mts/.mjs, so its script kind has to stay the one the language
            // service host reports for that extension. Inheriting the .gts/.gjs file's
            // Deferred kind makes TypeScript's getOrCreateSourceFileByPath see a script-kind
            // mismatch on the next program sync, and it responds by releasing and
            // re-acquiring the document instead of updating it — a full re-parse of every
            // twin, on every parse. It never settles either: the re-acquired file comes back
            // as TS, and the next call to this function stamps it back to Deferred.
            scriptKind: virtualSourceFile.scriptKind,
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
