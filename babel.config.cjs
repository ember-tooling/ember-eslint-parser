// Used by tests that exercise the JS-path of ember-eslint-parser, which
// delegates to @babel/eslint-parser. The decorators plugin lets fixtures
// pin behaviour for `@tracked` / `@service`-style class-field decorators
// — the syntax that broke when the JS fallback was raw espree.
module.exports = {
  plugins: [['@babel/plugin-proposal-decorators', { version: 'legacy' }]],
};
