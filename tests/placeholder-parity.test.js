import { describe, expect, it } from 'vitest';
import { toTree } from 'ember-estree';
import { transformForLint } from '../src/parser/transforms.js';

/**
 * transformForLint (used by the patched ts.sys.readFile for type-aware
 * linting) must produce byte-identical output to the placeholder JS that
 * ember-estree's toTree hands to the JS/TS parser at lint time.
 *
 * typescript-eslint hashes the code passed to parseForESLint and compares it
 * against what the watch program last read off disk; any difference marks the
 * file as changed and silently rebuilds the whole program inside
 * getProgram() — once per .gts/.gjs file linted (#229).
 */

function toTreePlaceholder(code) {
  let placeholder;
  try {
    toTree(code, {
      filePath: 'x.gts',
      parser: (js) => {
        placeholder = js;
        // Only the placeholder is needed; abort before JS parsing.
        throw new Error('stop');
      },
    });
  } catch {
    // expected
  }
  return placeholder;
}

const cases = {
  'backtick-heavy template comments (#226)': `import Component from '@glimmer/component';

export default class MyComponent extends Component {
  <template>
    {{!  \`asd\` \`qwe\` \`zxc\` \`undefined\` \`asd\` }}
    {{! \`@foo\` }}
  </template>
}
`,
  'expression template with dollar signs': `export const x = <template>costs \${{amount}} \`really\` $$$</template>;
`,
  'multibyte content (emoji, CJK)': `export const y = <template>🎉 日本語 \` $ 🚀</template>;
`,
  'CRLF line endings': `export const z = <template>\r\n  hi \`there\`\r\n</template>;\r\n`,
  'multiple templates in one module': `export const a = <template>one \`x\`</template>;
export const b = <template>two $y</template>;
`,
};

describe('transformForLint matches toTree placeholder byte-for-byte', () => {
  for (const [name, code] of Object.entries(cases)) {
    it(name, () => {
      expect(transformForLint(code).output).toBe(toTreePlaceholder(code));
    });
  }
});
