import type DynamicTarget from './dynamic-target.gts';

// Smoke test: dynamic import with .gts extension should not trigger
// @typescript-eslint/no-unsafe-assignment. Before the fix in ts-patch.js,
// TypeScript could not resolve the .gts path and inferred `any` for `mod`.
const load = async (): Promise<typeof DynamicTarget> => {
  const mod = await import('./dynamic-target.gts');
  return mod.default;
};

export { load };
