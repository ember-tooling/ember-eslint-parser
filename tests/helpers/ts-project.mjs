/**
 * Shared setup for anything that needs the parser's type-aware path: a throwaway
 * project on disk, and the `projectService` option spelling the installed
 * `@typescript-eslint/parser` understands.
 *
 * Used by both the vitest suite and the mitata benches, so it imports nothing
 * from either — the parser comes in as an argument, because the benches load a
 * second copy of it from the base branch.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Write a tsconfig and a set of files under a fresh temp directory.
 *
 * @param options.prefix          temp directory prefix, for recognising strays
 * @param options.compilerOptions merged over the defaults below
 * @param options.include         tsconfig `include`, defaults to the app folder
 * @param options.files           file contents keyed by path relative to `dir`
 * @returns {{dir: string, cleanup: () => void}}
 */
export function writeTempProject({ prefix, compilerOptions, include, files }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          ...compilerOptions,
        },
        include: include ?? ['app/**/*'],
      },
      null,
      2
    )
  );

  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(dir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }

  return {
    dir,
    cleanup() {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * Find the `projectService` spelling a parser accepts. It is named differently
 * across typescript-eslint majors and may be absent entirely, so probe rather
 * than hardcode.
 *
 * @param parse       a `parseForESLint`
 * @param baseOptions parser options minus the project service flag
 * @param probeFile   a file in the project to parse as the probe
 * @returns the options that produced a program, or null if none did
 */
export function detectProjectService(parse, baseOptions, probeFile) {
  for (const options of [{ projectService: true }, { EXPERIMENTAL_useProjectService: true }]) {
    try {
      const result = parse(fs.readFileSync(probeFile, 'utf8'), {
        ...baseOptions,
        ...options,
        filePath: probeFile,
      });
      if (result.services?.program) return options;
    } catch {
      // unsupported spelling — try the next one
    }
  }
  return null;
}
