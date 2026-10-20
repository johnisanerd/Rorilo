import { it, expect } from 'vitest';
import { sanitizePdfText } from '../lib/pdf/generatePdf';
import { cleanInvisibleText } from '../lib/text/clean';

it('strips invisible junk but keeps real text', () => {
  expect(sanitizePdfText('a\u200bb Silence')).toBe('ab Silence');
  expect(sanitizePdfText('IT\u0011Support')).toBe('ITSupport');
  expect(sanitizePdfText('x\u2009y')).toBe('x y');
  expect(sanitizePdfText('a\u00adb')).toBe('ab');
  expect(sanitizePdfText('one\u2003two\u2003three')).toBe('one two three');
  expect(sanitizePdfText('a\u200bb\u200cc\u200dd')).toBe('abcd');
});

it('drops bidi controls, private-use and variation selectors', () => {
  expect(cleanInvisibleText('a\u202Bb\u202Ac')).toBe('abc');
  expect(cleanInvisibleText('a\uE000b')).toBe('ab');
  expect(cleanInvisibleText('a\uFE0Fb')).toBe('ab');
  expect(cleanInvisibleText('Grüße für 50 € – „los“')).toBe('Grüße für 50 € – „los“');
});

it('folds unicode hyphens to ASCII so jsPDF does not space out the word', () => {
  // U+2011 (non-breaking) and U+2010 have no WinAnsi glyph in jsPDF's standard fonts.
  expect(sanitizePdfText('claude\u2011style')).toBe('claude-style');
  expect(sanitizePdfText('claude\u2010style')).toBe('claude-style');
  expect(sanitizePdfText('5\u2212 3')).toBe('5- 3');
  // En dash is in WinAnsi and stays as-is.
  expect(sanitizePdfText('claude\u2013style')).toBe('claude\u2013style');
});

it('maps exotic line breaks to newlines', () => {
  expect(cleanInvisibleText('a\u2028b\u2029c')).toBe('a\nb\nc');
});
