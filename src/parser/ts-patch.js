import fs from 'node:fs';
import { createRequire } from 'node:module';
import { transformForLint, replaceRange } from './transforms.js';

const require = createRequire(import.meta.url);

// Suffix of a virtual twin, stripped to recover the .gts/.gjs it stands in for.
const VIRTUAL_MTS_SUFFIX = /\.m?mts$/;
const VIRTUAL_MJS_SUFFIX = /\.m?mjs$/;

// Virtual .mts/.mjs source file -> the .gts/.gjs source file it currently
// mirrors. Weak so it follows the program's own lifetime.
const linkedVirtuals = new WeakMap();

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
    // Only `.gts` specifiers are rewritten, and every specifier the walk
    // below can successfully rewrite carries a literal `.gts` in the source
    // text. Worth the scan: the patched `ts.sys.readFile` runs this over
    // every .ts file TypeScript pulls into the program, and in an app of any
    // size almost none of them import a .gts.
    //
    // A specifier that spells the extension with an escape sequence or a line
    // continuation is the one case this skips that the walk did reach, since
    // its raw text has no `.gts` in it. The walk never rewrote those either:
    // it replaces the raw span with the cooked value, so the file came out
    // shorter and tripped the length assertion below. That throw reaches
    // ESLint as `Parsing error: bad replacement` on an otherwise valid file
    // (gjs-gts-parser calls this outside the readFile try/catch). It is now a
    // no-op instead, and TypeScript reports the unresolved module.
    if (!code.includes('.gts')) return code;

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
   * Mirror every .gts/.gjs source file onto the virtual .mts/.mjs twin that
   * TypeScript resolved imports to, so the checker sees the transformed AST.
   *
   * Runs after every type-aware parse and walks the whole program, so both the
   * per-source-file cost and the per-.gts cost show up once per linted file.
   *
   * @param program {ts.Program}
   */
  syncMtsGtsSourceFiles = function syncMtsGtsSourceFiles(program) {
    const sourceFiles = program.getSourceFiles();

    function linkVirtualFile(sourceFile, suffix, virtualSuffix, fallbackSuffix, virtualFlag) {
      const base = sourceFile.path.slice(0, -suffix.length);
      let virtualSourceFile = program.getSourceFile(base + virtualSuffix);
      if (!virtualSourceFile) {
        virtualSourceFile = program.getSourceFile(base + fallbackSuffix);
      }
      if (!virtualSourceFile) return;

      // Copying ~50 properties per .gts is the bulk of this function, and
      // nearly every call repeats a copy that is already in place. The hosts
      // used for type-aware linting hand back the same SourceFile object
      // until a file's content changes and build a new one when it does, so
      // an unchanged object on both sides means the twin is current. The
      // version check is a second opinion where the host maintains one (it is
      // a content hash under the watch host); user-supplied `programs` leave
      // it undefined, and there object identity carries the guard alone.
      if (
        linkedVirtuals.get(virtualSourceFile) === sourceFile &&
        virtualSourceFile.version === sourceFile.version
      ) {
        return;
      }

      const keep = {
        fileName: virtualSourceFile.fileName,
        path: virtualSourceFile.path,
        originalFileName: virtualSourceFile.originalFileName,
        resolvedPath: virtualSourceFile.resolvedPath,
        impliedNodeFormat: virtualSourceFile.impliedNodeFormat,
      };
      Object.assign(virtualSourceFile, sourceFile, keep);
      virtualSourceFile[virtualFlag] = true;
      linkedVirtuals.set(virtualSourceFile, sourceFile);
    }

    // A virtual outlives its original when the .gts/.gjs is deleted; clearing
    // the version makes TypeScript drop it on the next update.
    //
    // The flag also lands on the `.ts`/`.js` fallback twin, whose path the
    // suffix does not match. That case is self-correcting rather than
    // special-cased: the replace is a no-op, so the lookup finds the file by
    // its own path and nothing is invalidated.
    function invalidateOrphanedVirtual(sourceFile, virtualSuffix, suffix) {
      if (!program.getSourceFile(sourceFile.path.replace(virtualSuffix, suffix))) {
        sourceFile.version = null;
      }
    }

    // This walks every file in the program: app sources, lib.d.ts, every
    // .d.ts reachable from node_modules. So the uninteresting majority has to
    // fall out after a single suffix test.
    //
    // The branches cannot shadow each other. A .gts links `X.mts` or `X.ts`
    // and a .gjs links `X.mjs` or `X.js`, so no file is ever flagged both
    // virtual-gts and virtual-gjs, and neither flag can land on a path that
    // still ends in .gts or .gjs.
    for (const sourceFile of sourceFiles) {
      const path = sourceFile.path;
      if (path.endsWith('.gts')) {
        linkVirtualFile(sourceFile, '.gts', '.mts', '.ts', 'isVirtualGts');
      } else if (path.endsWith('.gjs')) {
        linkVirtualFile(sourceFile, '.gjs', '.mjs', '.js', 'isVirtualGjs');
      } else if (sourceFile.isVirtualGts) {
        invalidateOrphanedVirtual(sourceFile, VIRTUAL_MTS_SUFFIX, '.gts');
      } else if (sourceFile.isVirtualGjs) {
        invalidateOrphanedVirtual(sourceFile, VIRTUAL_MJS_SUFFIX, '.gjs');
      }
    }
  };
} catch /* istanbul ignore next */ {
  // typescript not available
  patchTs = () => null;
  replaceExtensions = (code) => code;
  syncMtsGtsSourceFiles = () => null;
}

export { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser };
