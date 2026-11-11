/**
 * TypeScript's ProjectService sums the size of every root it does not
 * recognise as TypeScript and, past `maxProgramSizeForNonTsFiles` (20MB),
 * calls `disableLanguageService` on the project. A disabled project reports
 * only the files the client currently has open as program roots.
 *
 * `parserOptions.projectService` opens one file at a time, so against a
 * demoted project every linted file forces a fresh `ts.Program`. That is
 * several times slower than sharing one program, and it also changes results:
 * ambient declarations the linted file does not import (`declare global`,
 * module augmentation, standalone `.d.ts`) are no longer in the program, so
 * type-aware rules see `any` where they would otherwise see a real type.
 *
 * None of that surfaces anywhere. This turns it into one line on stderr.
 *
 * @param {typeof import('typescript')} ts
 */
export function warnOnProjectSizeLimitDemotion(ts) {
  const proto = ts?.server?.Project?.prototype;
  if (!proto || typeof proto.disableLanguageService !== 'function') return;
  if (proto.disableLanguageService.__emberEslintParserWarns) return;

  const original = proto.disableLanguageService;
  let warned = false;

  function disableLanguageService(lastFileExceededProgramSize) {
    // The argument is only ever passed by the size heuristic, so its presence
    // is what distinguishes a demotion from any other reason a project might
    // have its language service turned off.
    if (lastFileExceededProgramSize && !warned) {
      warned = true;
      const projectName =
        typeof this.getProjectName === 'function' ? this.getProjectName() : '<unknown project>';
      const limitMb = Math.round((ts.server.maxProgramSizeForNonTsFiles ?? 0) / (1024 * 1024));
      // eslint-disable-next-line no-console
      console.warn(
        `ember-eslint-parser: TypeScript disabled the language service for ${projectName} ` +
          `because its non-TypeScript files exceed the ${limitMb}MB maxProgramSizeForNonTsFiles ` +
          `limit (tipped over by ${lastFileExceededProgramSize}).\n` +
          `  Type-aware linting keeps working, but TypeScript now rebuilds its program for every ` +
          `file instead of sharing one, and ambient declarations the linted file does not import ` +
          `drop out of that program, so type-aware rules can report differently.\n` +
          `  Set "disableSizeLimit": true in that tsconfig's compilerOptions to lift the limit. ` +
          `Note that .gjs files count toward it because they are JavaScript; .gts files do not.`
      );
    }
    return original.call(this, lastFileExceededProgramSize);
  }

  // Marked so repeated imports (or a second copy of this package) don't stack
  // wrappers on the same prototype.
  disableLanguageService.__emberEslintParserWarns = true;
  proto.disableLanguageService = disableLanguageService;
}
