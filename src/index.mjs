// Re-export the ESLint parser API (CJS interop)
import parser from './parser/gjs-gts-parser.js';
export const parseForESLint = parser.parseForESLint;
export const meta = parser.meta;
export default parser;

// Re-export parse/print from ember-estree
export { parse, print } from 'ember-estree';
