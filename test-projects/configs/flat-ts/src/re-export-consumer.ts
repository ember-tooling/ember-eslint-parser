import { targetFn } from './re-export-via-ts.ts';

// Smoke test for ember-cli/eslint-plugin-ember#2791.
//
// `re-export-via-ts.ts` re-exports a symbol from `re-export-target.gts`.
// Before the fix in `ts-patch.js`, `replaceExtensions` only rewrote
// `.gts` -> `.mts` in `ImportDeclaration` / dynamic `import()` nodes, so
// the `export { ... } from './foo.gts'` was left untouched and
// TypeScript's projectService could not resolve the transitive
// re-export. `targetFn` would be typed as `any` here, tripping
// `@typescript-eslint/no-unsafe-call`.
const value: number = targetFn();

export { value };
