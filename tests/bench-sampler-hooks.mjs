/**
 * Module loader hooks for increasing mitata sampling.
 *
 * Intercepts mitata's lib.mjs at load time and rewrites the
 * k_min_cpu_time and k_min_samples constants to 5× their defaults.
 */

const SAMPLE_MULTIPLIER = 5;

export async function load(url, context, nextLoad) {
  if (url.includes('mitata') && url.endsWith('lib.mjs')) {
    const result = await nextLoad(url, context);
    let source = typeof result.source === 'string'
      ? result.source
      : new TextDecoder().decode(result.source);

    source = source
      .replace(
        /export const k_min_cpu_time = .+/,
        `export const k_min_cpu_time = ${SAMPLE_MULTIPLIER} * 642 * 1e6;`,
      )
      .replace(
        /export const k_min_samples = .+/,
        `export const k_min_samples = ${SAMPLE_MULTIPLIER} * 12;`,
      );

    return { ...result, source, shortCircuit: true };
  }

  return nextLoad(url, context);
}
