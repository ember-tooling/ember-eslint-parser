import { Preprocessor } from 'content-tag';

export const replaceRange = function replaceRange(s, start, end, substitute) {
  return s.slice(0, start) + substitute + s.slice(end);
};

function maskTemplateContentForLint(content) {
  // Must produce byte-identical output to ember-estree's toPlaceholderJS
  // masking, or typescript-eslint sees two different contents for the same
  // .gts file (disk read vs lint parse) and invalidates + rebuilds the
  // program on every file.
  return content.replace(/[`$]/g, ' ');
}

const processor = new Preprocessor();

class EmberParserError extends Error {
  constructor(message, fileName, location) {
    super(message);
    this.location = location;
    this.fileName = fileName;
    Object.defineProperty(this, 'name', {
      configurable: true,
      enumerable: false,
      value: new.target.name,
    });
  }

  get index() {
    return this.location.start.offset;
  }

  get lineNumber() {
    return this.location.start.line;
  }

  get column() {
    return this.location.start.column;
  }
}

function createError(code, message, fileName, start, end = start) {
  return new EmberParserError(message, fileName, { end, start });
}

/**
 * Transform code for TypeScript virtual file system.
 * Replaces <template> regions with void-backtick/static-block placeholders.
 * Used by ts-patch.js, which serves it as the .gts/.gjs file content to the classic TypeScript program.
 */
export function transformForLint(code, fileName) {
  let result;
  try {
    result = processor.parse(code);
  } catch (e) {
    if (e.message.includes('Parse Error at')) {
      const [line, column] = e.message
        .split(':')
        .slice(-2)
        .map((x) => parseInt(x));
      throw createError(code, e.source_code, fileName, { line, column });
    }
    throw e;
  }

  // Build placeholder JS inline (same format as ember-estree's toPlaceholderJS)
  let jsCode = code;
  for (const tplInfo of [...result].reverse()) {
    const content = maskTemplateContentForLint(
      code.slice(tplInfo.contentRange.startUtf16Codepoint, tplInfo.contentRange.endUtf16Codepoint)
    );
    const start = tplInfo.range.startUtf16Codepoint;
    const end = tplInfo.range.endUtf16Codepoint;
    const tplLength = end - start;
    let replacement;
    if (tplInfo.type === 'class-member') {
      const spaces = tplLength - content.length - 10; // "static{`" + "`}" = 10
      replacement = `static{\`${content}${' '.repeat(Math.max(0, spaces))}\`}`;
    } else {
      const spaces = tplLength - content.length - 7; // "void `" + "`" = 7
      replacement = `void \`${content}${' '.repeat(Math.max(0, spaces))}\``;
    }
    jsCode = replaceRange(jsCode, start, end, replacement);
  }

  /* istanbul ignore next */
  if (jsCode.length !== code.length) {
    throw new Error('bad transform');
  }
  return {
    templateInfos: result,
    output: jsCode,
  };
}
