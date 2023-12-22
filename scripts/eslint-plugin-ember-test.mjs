/* globals $, within */
import 'zx/globals';

const FOLDERS = {
  testRoot: '/tmp/eslint-plugin-ember-test/',
};

await $`yarn link`;

within(async () => {
  await $`mkdir -p ${FOLDERS.testRoot}`;
  await $`cd ${FOLDERS.testRoot}`;

  await $`git clone https://github.com/ember-cli/eslint-plugin-ember.git`;
  await $`cd eslint-plugin-ember`;
  await $`yarn link ember-eslint-parser`;

  // debug
  await $`ls -la node_modules | grep ember-eslint-parser`;

  // run tests
  await $`yarn test`;
});
