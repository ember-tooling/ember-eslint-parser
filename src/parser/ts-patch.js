import fs from 'node:fs';
import { createRequire } from 'node:module';
import { transformForLint } from './transforms.js';

const require = createRequire(import.meta.url);

let patchTs, syncMtsGtsSourceFiles, typescriptParser, isPatched;

/**
 * Replace `.gts` with `.mts` in ES import/export module specifiers.
 *
 * This runs as a preprocessing step before handing code to
 * `@typescript-eslint/parser` so that its type-aware resolution follows
 * the virtual `.mts` twins that {@link patchTs} synthesises.
 *
 * Implemented as a small hand-written scanner instead of leaning on the
 * TypeScript compiler API so it keeps working when TypeScript itself
 * isn't installed, or when the installed `typescript` package exposes no
 * JS compiler API (e.g. the `typescript-go` native port shipped as TS 7).
 *
 * The scanner walks the source once, skipping over comments, template
 * literals, and string literals that aren't in a module-specifier
 * position, and only rewrites the extension inside string literals
 * that follow `from`, `import`, or `import(`. Length is preserved
 * (`.gts` and `.mts` are both 4 characters), matching the invariant
 * downstream code relies on for range fidelity.
 *
 * @param {string} code
 * @returns {string}
 */
function replaceExtensions(code) {
  const len = code.length;
  const out = [];
  let i = 0;
  // Tracks the most recent module-specifier–introducing token. `from`
  // and bare `import` both accept a string literal next; `importParen`
  // is set on the `(` of a dynamic `import(...)` call and tolerates
  // whitespace/comments before the specifier. Any other identifier,
  // punctuation, or template/regex context clears it.
  let mode = null;

  const isIdStart = (ch) =>
    (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_' || ch === '$';
  const isIdPart = (ch) => isIdStart(ch) || (ch >= '0' && ch <= '9');

  while (i < len) {
    const c = code[i];

    // Line comment — preserve, don't change mode.
    if (c === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i + 2);
      const end = nl === -1 ? len : nl;
      out.push(code.slice(i, end));
      i = end;
      continue;
    }

    // Block comment — preserve, don't change mode.
    if (c === '/' && code[i + 1] === '*') {
      const close = code.indexOf('*/', i + 2);
      const end = close === -1 ? len : close + 2;
      out.push(code.slice(i, end));
      i = end;
      continue;
    }

    // Template literal — passthrough (dynamic import with a template
    // specifier isn't a static module reference we want to rewrite).
    if (c === '`') {
      let j = i + 1;
      let depth = 0;
      while (j < len) {
        const ch = code[j];
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (depth === 0 && ch === '`') {
          j++;
          break;
        }
        if (ch === '$' && code[j + 1] === '{') {
          depth++;
          j += 2;
          continue;
        }
        if (depth > 0 && ch === '}') {
          depth--;
          j++;
          continue;
        }
        j++;
      }
      out.push(code.slice(i, j));
      i = j;
      mode = null;
      continue;
    }

    // String literal.
    if (c === "'" || c === '"') {
      const quote = c;
      let j = i + 1;
      while (j < len) {
        const ch = code[j];
        if (ch === '\\') {
          j += 2;
          continue;
        }
        if (ch === quote) {
          j++;
          break;
        }
        if (ch === '\n') break; // unterminated — bail out safely
        j++;
      }
      const literal = code.slice(i, j);
      const suffix = '.gts' + quote;
      if (
        (mode === 'from' || mode === 'import' || mode === 'importParen') &&
        literal.endsWith(suffix)
      ) {
        out.push(literal.slice(0, -suffix.length) + '.mts' + quote);
      } else {
        out.push(literal);
      }
      i = j;
      mode = null;
      continue;
    }

    // Identifier / keyword.
    if (isIdStart(c)) {
      let j = i + 1;
      while (j < len && isIdPart(code[j])) j++;
      const ident = code.slice(i, j);
      out.push(ident);
      if (ident === 'from') mode = 'from';
      else if (ident === 'import') mode = 'import';
      else mode = null;
      i = j;
      continue;
    }

    // Whitespace preserves mode so `from   'x.gts'`, `import(\n  'x.gts')`,
    // and comment-interleaved forms all keep replacing.
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      out.push(c);
      i++;
      continue;
    }

    // Opening paren after `import` — dynamic import call.
    if (c === '(' && mode === 'import') {
      out.push(c);
      i++;
      mode = 'importParen';
      continue;
    }

    // Any other punctuation resets mode, except while we're already
    // inside a dynamic-import argument list waiting for its specifier.
    out.push(c);
    i++;
    if (mode !== 'importParen') mode = null;
  }

  return out.join('');
}

// Load `@typescript-eslint/parser` independently of the TypeScript compiler
// API. TS 7+ ships as `typescript-go` (a native binary) and exposes no JS
// compiler API — resolving `typescript` from disk throws
// `ERR_PACKAGE_PATH_NOT_EXPORTED`. Older logic combined both loads in a
// single try/catch, so any TS-side failure silently disabled the ts-eslint
// parser as well. Keep them separate.
try {
  typescriptParser = require('@typescript-eslint/parser');
} catch /* istanbul ignore next */ {
  typescriptParser = undefined;
}

try {
  const parserPath = require.resolve('@typescript-eslint/parser');
  // eslint-disable-next-line n/no-unpublished-require
  const tsPath = require.resolve('typescript', { paths: [parserPath] });
  const ts = require(tsPath);
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
  // TypeScript compiler API not available (e.g. `typescript` isn't
  // installed, or the installed build — such as the TS 7 `typescript-go`
  // native port — exposes no JS compiler entry point). `patchTs` becomes
  // a no-op; `replaceExtensions` is defined at module scope above and
  // works without the compiler API.
  patchTs = () => null;
  syncMtsGtsSourceFiles = () => null;
}

export { patchTs, replaceExtensions, syncMtsGtsSourceFiles, typescriptParser };
