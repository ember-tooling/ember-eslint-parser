import path from 'node:path';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseForESLint } from '../src/parser/gjs-gts-parser.js';

/**
 * A project-mode program can hold one templated file under several paths:
 * the `.gts` root, a `.ts` virtual created when another file resolves
 * `import './x'` extensionless through the patched fileExists, and — on
 * newer typescript-eslint/TypeScript versions — a `.mts` twin injected as a
 * root via the patched readDirectory. If a copy keeps its own AST it gets
 * its own class symbols, so a class with a private member is not assignable
 * to itself across import paths — the source of the order-dependent false
 * positives in typed rules reported in #229
 * (`no-unnecessary-type-assertion`, `no-redundant-type-constituents`).
 *
 * syncMtsGtsSourceFiles must graft the real SourceFile onto EVERY virtual
 * twin present (not just the first found), and must do so only once per
 * program — re-grafting after later parses rewrites binder state under a
 * live type checker.
 *
 * The suite runs under both `project` and `projectService`, the two ways
 * typed linting obtains a program. projectService is feature-detected: its
 * option spelling varies across typescript-eslint majors, and v7's
 * experimental service can't hold `.gts` files in-project (the resulting
 * default-project program has no virtual twins, leaving nothing to graft).
 */

const fixtureDir = path.join(import.meta.dirname, 'fixtures', 'type-identity');
const privPath = path.join(fixtureDir, 'priv.gts');
const otherPath = path.join(fixtureDir, 'other.gts');

function parseWith(modeOptions, filePath) {
  return parseForESLint(fs.readFileSync(filePath, 'utf8'), {
    filePath,
    ...modeOptions,
    tsconfigRootDir: fixtureDir,
    extraFileExtensions: ['.gts', '.gjs'],
    loc: true,
    range: true,
    tokens: true,
    comment: true,
    sourceType: 'module',
  });
}

function virtualTwinsOf(program, gtsPath) {
  return [
    program.getSourceFile(gtsPath.replace(/\.gts$/, '.mts')),
    program.getSourceFile(gtsPath.replace(/\.gts$/, '.ts')),
  ].filter(Boolean);
}

const MODES = [['project', { project: './tsconfig.json' }]];

for (const options of [{ projectService: true }, { EXPERIMENTAL_useProjectService: true }]) {
  try {
    const program = parseWith(options, privPath).services?.program;
    if (program?.getSourceFile(privPath) && virtualTwinsOf(program, privPath).length > 0) {
      MODES.push(['projectService', options]);
      break;
    }
  } catch {
    // spelling unsupported by the installed @typescript-eslint/parser
  }
}

for (const [modeName, modeOptions] of MODES) {
  const parse = (filePath) => parseWith(modeOptions, filePath);

  describe(`virtual twin type identity (#229) — ${modeName}`, () => {
    it('grafts the real .gts SourceFile onto every virtual twin in the program', () => {
      const result = parse(privPath);
      const program = result.services.program;

      const gts = program.getSourceFile(privPath);
      expect(gts).toBeTruthy();

      // consumer.ts imports './priv' extensionless, so at minimum the
      // resolver-created .ts virtual exists; depending on the TS version a
      // readDirectory-injected .mts twin exists as well.
      const twins = virtualTwinsOf(program, privPath);
      expect(twins.length).toBeGreaterThanOrEqual(1);

      for (const twin of twins) {
        expect(twin.statements).toBe(gts.statements);
        expect(twin.isVirtualGts).toBe(true);
      }
    });

    it('a private-member class has one type identity across import paths', () => {
      const result = parse(privPath);
      const program = result.services.program;
      const checker = program.getTypeChecker();

      const gts = program.getSourceFile(privPath);
      const classOf = (sf) => sf.statements.find((s) => s.name?.escapedText === 'Priv');
      const typeOf = (sf) =>
        checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(classOf(sf).name));

      const gtsType = typeOf(gts);
      for (const twin of virtualTwinsOf(program, privPath)) {
        const twinType = typeOf(twin);
        // Identical, not merely mutually assignable: statements are shared,
        // so both paths reach the same class declaration node.
        expect(twinType).toBe(gtsType);
        expect(checker.isTypeAssignableTo(gtsType, twinType)).toBe(true);
        expect(checker.isTypeAssignableTo(twinType, gtsType)).toBe(true);
      }
    });

    it('does not re-graft an already-synced program on later parses', () => {
      const first = parse(privPath);
      const program = first.services.program;

      const [twin] = virtualTwinsOf(program, privPath);
      expect(twin).toBeTruthy();
      // Bind, then plant a canary where the graft writes its marker flag. A
      // re-graft on the next parse would overwrite it (and with it, live
      // binder state such as symbol/locals — the #229 non-determinism vector).
      program.getTypeChecker().getSymbolAtLocation(twin);
      twin.isVirtualGts = 'already-synced-canary';

      const second = parse(otherPath);
      expect(second.services.program).toBe(program);
      expect(twin.isVirtualGts).toBe('already-synced-canary');
    });
  });
}
