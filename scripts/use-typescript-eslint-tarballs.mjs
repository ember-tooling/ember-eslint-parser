/**
 * Points a project's typescript-eslint packages at the tarballs made by
 * scripts/build-typescript-eslint-tsgo.sh, through `pnpm.overrides`.
 *
 * usage: node scripts/use-typescript-eslint-tarballs.mjs <tarball dir> <project dir>
 */
import fs from 'node:fs';
import path from 'node:path';

const [tarballDir, projectDir] = process.argv.slice(2).map((p) => path.resolve(p));

const overrides = {};
for (const file of fs.readdirSync(tarballDir)) {
  // `pnpm pack` names @typescript-eslint/parser@8.72.0 typescript-eslint-parser-8.72.0.tgz,
  // and the unscoped typescript-eslint@8.72.0 typescript-eslint-8.72.0.tgz.
  const match = /^typescript-eslint-(?:([a-z-]+)-)?\d+\.\d+\.\d+.*\.tgz$/.exec(file);
  if (!match) continue;
  const name = match[1] ? `@typescript-eslint/${match[1]}` : 'typescript-eslint';
  overrides[name] = `file:${path.join(tarballDir, file)}`;
}

if (!overrides['@typescript-eslint/typescript-estree'] || !overrides['typescript-eslint']) {
  throw new Error(`No typescript-eslint tarballs found in ${tarballDir}`);
}

const manifestPath = path.join(projectDir, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.pnpm = { ...manifest.pnpm, overrides: { ...manifest.pnpm?.overrides, ...overrides } };
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

console.log(JSON.stringify(overrides, null, 2));
