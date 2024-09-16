import { execaCommand } from 'execa';
import fse from 'fs-extra';

const REPO = `https://github.com/ember-cli/eslint-plugin-ember.git`;
const FOLDERS = {
  here: process.cwd(),
  testRoot: '/tmp/eslint-plugin-ember-test/',
  repo: '/tmp/eslint-plugin-ember-test/eslint-plugin-ember',
};

await fse.remove(FOLDERS.testRoot);
await fse.ensureDir(FOLDERS.testRoot);

// Using pnpm instead of yarn, because pnpm is way faster
await execaCommand(`git clone ${REPO}`, { cwd: FOLDERS.testRoot, stdio: 'inherit' });
await execaCommand(`git checkout 8f485b2198ce143ccbf88768fa36316d82cc36ae`, {
  cwd: FOLDERS.repo,
  stdio: 'inherit',
});
await execaCommand(`pnpm install --frozen-lockfile`, { cwd: FOLDERS.repo, stdio: 'inherit' });
await execaCommand(`pnpm add ${FOLDERS.here}`, { cwd: FOLDERS.repo, stdio: 'inherit' });
await execaCommand(`pnpm run test`, { cwd: FOLDERS.repo, stdio: 'inherit' });
