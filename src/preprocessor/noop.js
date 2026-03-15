/**
 * this preprocessor validates if eslint if configured correctly so that gjs/gts are correctly processed by our parser
 * this preprocessor is setup by our recommended rules for gjs/gts, so it will always be called for it
 * the flow is the following:
 *  1. gjs/gts files goes through our parses, which calls registerParsedFile, if its not correctly setup, registerParsedFile will not be called
 *  2. postprocess checks if the file is registered and if not throws an error
 *
 */

const parsedFiles = new Set();

export function registerParsedFile(f) {
  parsedFiles.add(f);
}

export const preprocess = undefined;

export function postprocess(messages, fileName) {
  const msgs = messages.flat();
  if (!parsedFiles.has(fileName)) {
    msgs[0] = msgs[0] || {
      message: '',
    };
    msgs[0].message += '\n';
    msgs[0].message +=
      'To lint Gjs/Gts files please follow the setup guide at https://github.com/ember-cli/eslint-plugin-ember#gtsgjs' +
      '\nNote that this error can also happen if you have multiple versions of eslint-plugin-ember in your node_modules';
  }
  parsedFiles.delete(fileName); // required for tests
  return msgs;
}

export const supportsAutofix = true;

export default { registerParsedFile, preprocess, postprocess, supportsAutofix };
