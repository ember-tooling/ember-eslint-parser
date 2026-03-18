import { execaCommand } from 'execa';
import fse from 'fs-extra';

// Use the fork branch that has the GlimmerBlockParam nodeType fix
// until https://github.com/ember-cli/eslint-plugin-ember/pull/2577 merges,
// then switch back to ember-cli/eslint-plugin-ember.
const REPO = `https://github.com/NullVoxPopuli-ai-agent/eslint-plugin-ember.git`;
const BRANCH = 'update-blockparam-nodetype';
const FOLDERS = {
  here: process.cwd(),
  testRoot: '/tmp/eslint-plugin-ember-test/',
  repo: '/tmp/eslint-plugin-ember-test/eslint-plugin-ember',
};

await fse.remove(FOLDERS.testRoot);
await fse.ensureDir(FOLDERS.testRoot);

// Using pnpm instead of yarn, because pnpm is way faster
await execaCommand(`git clone --branch ${BRANCH} ${REPO}`, {
  cwd: FOLDERS.testRoot,
  stdio: 'inherit',
});
await execaCommand(`pnpm install`, { cwd: FOLDERS.repo, stdio: 'inherit' });
await execaCommand(`pnpm add ${FOLDERS.here}`, { cwd: FOLDERS.repo, stdio: 'inherit' });
await execaCommand(`pnpm run test`, { cwd: FOLDERS.repo, stdio: 'inherit' });
