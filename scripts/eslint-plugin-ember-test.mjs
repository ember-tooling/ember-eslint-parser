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
await execaCommand(`pnpm install`, { cwd: FOLDERS.repo, stdio: 'inherit' });
await execaCommand(`pnpm add ${FOLDERS.here}`, { cwd: FOLDERS.repo, stdio: 'inherit' });

// ember-estree renames BlockParam → GlimmerBlockParam for consistency with
// all other Glimmer-prefixed node types.  Patch the downstream assertion.
const testFile = `${FOLDERS.repo}/tests/lib/rules-preprocessor/gjs-gts-parser-test.js`;
const content = await fse.readFile(testFile, 'utf8');
await fse.writeFile(testFile, content.replaceAll('nodeType: BlockParam', 'nodeType: GlimmerBlockParam'));

await execaCommand(`pnpm run test`, { cwd: FOLDERS.repo, stdio: 'inherit' });
