/**
 * Node.js module-resolution hook that increases mitata's sampling constants.
 *
 * Register via: node --import ./tests/bench-sampler.mjs ...
 *
 * This uses Node's module customization API to intercept mitata's lib.mjs
 * at load time and replace the min_cpu_time / min_samples constants with
 * higher values (5×) for more stable results on CI.
 */

import { register } from 'node:module';

register(new URL('./bench-sampler-hooks.mjs', import.meta.url));
