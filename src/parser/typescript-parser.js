import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * `@typescript-eslint/parser` is an optional peer: JS-only projects lint .gjs with
 * `@babel/eslint-parser` instead. Both TypeScript backends (ts6/ and ts7/) parse
 * through it; they differ only in how the type information is produced.
 */
let typescriptParser = null;
try {
  typescriptParser = require('@typescript-eslint/parser');
} catch {
  // optional peer; left null
}

export { typescriptParser };
