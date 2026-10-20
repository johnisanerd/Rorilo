import { it, expect } from 'vitest';
import {
  cleanList,
  normalizeLocations,
  normalizeRoleSuggestions,
  normalizeSearchQuery,
  parseStringList,
} from '../lib/jobs/search-strategy';

it('cleans lists: trims, collapses whitespace, drops duplicates case-insensitively, caps count', () => {
  expect(cleanList(['  React   Developer ', 'react developer', '', 'Node', 42, 'TypeScript'], 2, 80)).toEqual([
    'React Developer',
    'Node',
  ]);
  expect(cleanList('not a list', 5, 80)).toEqual([]);
});

it('caps each string at the given length', () => {
  expect(cleanList(['abcdef'], 5, 3)).toEqual(['abc']);
});

it('normalizes role suggestions and drops empty or repeated titles', () => {
  const roles = normalizeRoleSuggestions([
    { title: 'Frontend Developer', keywords: ['React', 'react', ' TypeScript '] },
    { title: 'frontend developer', keywords: ['Vue'] },
    { title: '   ', keywords: ['Ignored'] },
    { title: 'Full Stack Developer' },
  ]);
  expect(roles).toEqual([
    { title: 'Frontend Developer', keywords: ['React', 'TypeScript'] },
    { title: 'Full Stack Developer', keywords: [] },
  ]);
});

it('limits the number of suggested roles', () => {
  const raw = Array.from({ length: 10 }, (_, i) => ({ title: `Role ${i}`, keywords: [] }));
  expect(normalizeRoleSuggestions(raw, 3).map((role) => role.title)).toEqual(['Role 0', 'Role 1', 'Role 2']);
});

it('normalizes suggested locations', () => {
  expect(normalizeLocations(['Eindhoven', ' eindhoven ', 'Remote', null])).toEqual(['Eindhoven', 'Remote']);
});

it('parses a natural-language query into filters', () => {
  const parsed = normalizeSearchQuery({
    roles: ['Entry-level Developer', 'Junior Developer', 'Junior Developer', 'a', 'b', 'c'],
    keywords: ['React'],
    location: 'Eindhoven',
    country: 'nl',
    remote: 'Remote',
    datePosted: 'week',
  });
  expect(parsed).toEqual({
    roles: ['Entry-level Developer', 'Junior Developer', 'a', 'b'],
    keywords: ['React'],
    location: 'Eindhoven',
    country: 'NL',
    remote: 'remote',
    datePosted: 'week',
  });
});

it('falls back to safe defaults for unknown filter values', () => {
  const parsed = normalizeSearchQuery({
    roles: [],
    keywords: [],
    location: undefined,
    country: 'ZZ',
    remote: 'sometimes',
    datePosted: 'yesterday',
  });
  expect(parsed.country).toBe('');
  expect(parsed.remote).toBe('any');
  expect(parsed.datePosted).toBe('any');
  expect(parsed.location).toBe('');
});

it('parses stored JSON string arrays without throwing', () => {
  expect(parseStringList('["React", " Node ", 3]')).toEqual(['React', 'Node']);
  expect(parseStringList('{bad json')).toEqual([]);
  expect(parseStringList('{"a":1}')).toEqual([]);
  expect(parseStringList(null)).toEqual([]);
});
