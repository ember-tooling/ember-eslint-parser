import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bench, describe } from 'vitest';
import { parseForESLint as parseGjsGts } from '../src/parser/gjs-gts-parser.js';
import { parseForESLint as parseHbs } from '../src/parser/hbs-parser.js';

// ---------------------------------------------------------------------------
// Fixture content – representative Glimmer / Ember source at three sizes,
// loaded from tests/bench/ so editors apply proper GTS/GJS/HBS highlighting.
// ---------------------------------------------------------------------------

function fixture(name) {
  return readFileSync(fileURLToPath(new URL(`./bench/${name}`, import.meta.url)), 'utf8');
}

const SMALL_GTS = fixture('small.gts');
const MEDIUM_GTS = fixture('medium.gts');
const LARGE_GTS = fixture('large.gts');

const SMALL_GJS = fixture('small.gjs');
const MEDIUM_GJS = fixture('medium.gjs');
const LARGE_GJS = fixture('large.gjs');

const SMALL_HBS = fixture('small.hbs');
const MEDIUM_HBS = fixture('medium.hbs');
const LARGE_HBS = fixture('large.hbs');

// ---------------------------------------------------------------------------
// Parse options (mirrors what ESLint passes at runtime)
// ---------------------------------------------------------------------------

const PARSE_OPTIONS = {
  comment: true,
  loc: true,
  range: true,
  tokens: true,
};

// ---------------------------------------------------------------------------
// Benchmarks
// ---------------------------------------------------------------------------

describe('gts parser', () => {
  bench('small file', () => {
    parseGjsGts(SMALL_GTS, { ...PARSE_OPTIONS, filePath: 'small.gts' });
  });

  bench('medium file', () => {
    parseGjsGts(MEDIUM_GTS, { ...PARSE_OPTIONS, filePath: 'medium.gts' });
  });

  bench('large file', () => {
    parseGjsGts(LARGE_GTS, { ...PARSE_OPTIONS, filePath: 'large.gts' });
  });
});

describe('gjs parser', () => {
  bench('small file', () => {
    parseGjsGts(SMALL_GJS, { ...PARSE_OPTIONS, filePath: 'small.gjs' });
  });

  bench('medium file', () => {
    parseGjsGts(MEDIUM_GJS, { ...PARSE_OPTIONS, filePath: 'medium.gjs' });
  });

  bench('large file', () => {
    parseGjsGts(LARGE_GJS, { ...PARSE_OPTIONS, filePath: 'large.gjs' });
  });
});

describe('hbs parser', () => {
  bench('small file', () => {
    parseHbs(SMALL_HBS, { ...PARSE_OPTIONS, filePath: 'small.hbs' });
  });

  bench('medium file', () => {
    parseHbs(MEDIUM_HBS, { ...PARSE_OPTIONS, filePath: 'medium.hbs' });
  });

  bench('large file', () => {
    parseHbs(LARGE_HBS, { ...PARSE_OPTIONS, filePath: 'large.hbs' });
  });
});
