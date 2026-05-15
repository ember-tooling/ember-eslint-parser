import { describe, expect, it } from 'vitest';
import {
  EMBER_71_BUILT_IN_KEYWORDS,
  isEmber71BuiltInKeywordForVersion,
} from '../src/parser/ember71-built-in-keywords.js';

describe('isEmber71BuiltInKeywordForVersion', () => {
  const NAMES = [
    'and',
    'array',
    'element',
    'eq',
    'fn',
    'gt',
    'gte',
    'hash',
    'lt',
    'lte',
    'neq',
    'not',
    'on',
    'or',
  ];

  it('exposes the 14 Ember 7.1 keywords', () => {
    expect(EMBER_71_BUILT_IN_KEYWORDS).toEqual(new Set(NAMES));
  });

  it.each(NAMES)('treats %s as a built-in on 7.1.0', (name) => {
    expect(isEmber71BuiltInKeywordForVersion(name, '7.1.0')).toBe(true);
  });

  it('treats keywords as built-ins on a 7.1 prerelease', () => {
    expect(isEmber71BuiltInKeywordForVersion('eq', '7.1.0-beta.1')).toBe(true);
  });

  it('treats keywords as built-ins on a 7.x release > 7.1', () => {
    expect(isEmber71BuiltInKeywordForVersion('eq', '7.2.0')).toBe(true);
  });

  it('treats keywords as built-ins on a future major', () => {
    expect(isEmber71BuiltInKeywordForVersion('on', '8.0.0-beta.1')).toBe(true);
  });

  it.each(['7.0.5', '6.4.0', '5.0.0'])('does not treat keywords as built-ins on %s', (version) => {
    expect(isEmber71BuiltInKeywordForVersion('eq', version)).toBe(false);
  });

  it('returns false when the version is missing', () => {
    expect(isEmber71BuiltInKeywordForVersion('eq', undefined)).toBe(false);
    expect(isEmber71BuiltInKeywordForVersion('eq', null)).toBe(false);
  });

  it('returns false for names outside the 7.1 keyword set', () => {
    expect(isEmber71BuiltInKeywordForVersion('myHelper', '7.1.0')).toBe(false);
    expect(isEmber71BuiltInKeywordForVersion('component', '7.1.0')).toBe(false);
  });
});
