import { z } from 'zod';
import { COUNTRY_OPTIONS, normalizeCountryCode } from '@/lib/job-sources/countries';

export const MAX_SUGGESTED_ROLES = 6;
export const MAX_ROLES_PER_SEARCH = 4;
const MAX_ROLE_CHARS = 80;
const MAX_KEYWORDS_PER_ROLE = 6;
const MAX_KEYWORD_CHARS = 40;
const MAX_LOCATIONS = 5;
const MAX_LOCATION_CHARS = 120;
const MAX_INPUT_CHARS = 2000;

export const REMOTE_PREFERENCES = ['any', 'remote', 'hybrid', 'onsite'] as const;
export const DATE_POSTED_OPTIONS = ['any', '24h', 'week', 'month'] as const;

export type RemotePreference = (typeof REMOTE_PREFERENCES)[number];
export type DatePostedOption = (typeof DATE_POSTED_OPTIONS)[number];

export interface RoleSuggestion {
  title: string;
  keywords: string[];
}

export interface ParsedSearchQuery {
  roles: string[];
  keywords: string[];
  location: string;
  country: string;
  remote: RemotePreference;
  datePosted: DatePostedOption;
}

/** Shape the model is asked to return for role suggestions. */
export const RoleStrategySchema = z.object({
  roles: z.array(z.object({ title: z.unknown(), keywords: z.unknown().optional() })).default([]),
  locations: z.array(z.unknown()).default([]),
});

/** Shape the model is asked to return for a natural-language search query. */
export const SearchQuerySchema = z.object({
  roles: z.array(z.unknown()).default([]),
  keywords: z.array(z.unknown()).default([]),
  location: z.unknown().optional(),
  country: z.unknown().optional(),
  remote: z.unknown().optional(),
  datePosted: z.unknown().optional(),
});

/** Trims, collapses whitespace, drops empties and case-insensitive duplicates, caps length and count. */
export function cleanList(value: unknown, max: number, maxChars: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const text = item.replace(/\s+/g, ' ').trim().slice(0, maxChars);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

function cleanText(value: unknown, maxChars: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxChars) : '';
}

/** Parses a JSON string array column (as stored in Prisma) without throwing. */
export function parseStringList(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? cleanList(parsed, 50, 120) : [];
  } catch {
    return [];
  }
}

export function normalizeRoleSuggestions(
  raw: Array<{ title: unknown; keywords?: unknown }>,
  max = MAX_SUGGESTED_ROLES,
): RoleSuggestion[] {
  const seen = new Set<string>();
  const roles: RoleSuggestion[] = [];
  for (const item of raw) {
    const [title] = cleanList([item.title], 1, MAX_ROLE_CHARS);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    roles.push({ title, keywords: cleanList(item.keywords, MAX_KEYWORDS_PER_ROLE, MAX_KEYWORD_CHARS) });
    if (roles.length >= max) break;
  }
  return roles;
}

export function normalizeLocations(raw: unknown[]): string[] {
  return cleanList(raw, MAX_LOCATIONS, MAX_LOCATION_CHARS);
}

function isRemotePreference(value: string): value is RemotePreference {
  return (REMOTE_PREFERENCES as readonly string[]).includes(value);
}

function isDatePostedOption(value: string): value is DatePostedOption {
  return (DATE_POSTED_OPTIONS as readonly string[]).includes(value);
}

export function normalizeSearchQuery(raw: z.infer<typeof SearchQuerySchema>): ParsedSearchQuery {
  const countryInput = cleanText(raw.country, 60);
  const countryCode = countryInput ? normalizeCountryCode(countryInput) : '';
  const remote = cleanText(raw.remote, 20).toLowerCase();
  const datePosted = cleanText(raw.datePosted, 20).toLowerCase();
  return {
    roles: cleanList(raw.roles, MAX_ROLES_PER_SEARCH, MAX_ROLE_CHARS),
    keywords: cleanList(raw.keywords, MAX_KEYWORDS_PER_ROLE, MAX_KEYWORD_CHARS),
    location: cleanText(raw.location, MAX_LOCATION_CHARS),
    country: COUNTRY_OPTIONS.some((option) => option.code === countryCode) ? countryCode : '',
    remote: isRemotePreference(remote) ? remote : 'any',
    datePosted: isDatePostedOption(datePosted) ? datePosted : 'any',
  };
}

export interface StrategyProfile {
  currentTitle: string;
  yearsExperience: number;
  city: string;
  country: string;
  skills: string[];
  technologies: string[];
  languages: string[];
  workExperience: unknown;
  cvText: string;
  remotePreference: string;
  employmentTypes: string[];
  preferredLocations: string[];
  excludedKeywords: string[];
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Prompt that turns a candidate profile into role and location suggestions. */
export function buildStrategyPrompt(profile: StrategyProfile): string {
  const experience = JSON.stringify(profile.workExperience ?? []).slice(0, 3000);
  return `Suggest job search roles for the candidate below.

Rules:
- Propose ${MAX_SUGGESTED_ROLES} or fewer job titles that fit the candidate's real experience and skills, from most to least fitting.
- Mix the closest match with realistic adjacent roles. Include a seniority level only when the experience supports it.
- For each role, give up to ${MAX_KEYWORDS_PER_ROLE} short search keywords (technologies or specialties). No sentences.
- Do not suggest roles the candidate's excluded keywords rule out.
- Suggest up to ${MAX_LOCATIONS} search locations (cities or countries) based on the candidate's home location and preferred locations. Use an empty list when nothing is known.
- Use only information in the candidate data. Do not invent experience.

Candidate:
- Current title: ${clip(profile.currentTitle, 200) || 'unknown'}
- Years of experience: ${profile.yearsExperience || 'unknown'}
- Home location: ${[profile.city, profile.country].filter(Boolean).join(', ') || 'unknown'}
- Preferred locations: ${profile.preferredLocations.join(', ') || 'none'}
- Remote preference: ${profile.remotePreference}
- Employment types: ${profile.employmentTypes.join(', ') || 'any'}
- Skills: ${profile.skills.join(', ') || 'none listed'}
- Technologies: ${profile.technologies.join(', ') || 'none listed'}
- Languages: ${profile.languages.join(', ') || 'none listed'}
- Excluded keywords: ${profile.excludedKeywords.join(', ') || 'none'}
- Work experience (JSON): ${experience}
- CV text:
"""
${clip(profile.cvText, 8000) || '(no CV uploaded)'}
"""

Return exactly this shape:
{"roles":[{"title":"","keywords":[""]}],"locations":[""]}`;
}

/** Prompt that turns a natural-language search sentence into structured filters. */
export function buildSearchQueryPrompt(query: string, today: string): string {
  return `Convert the job search request below into structured search filters.

Rules:
- roles: job titles to search for, at most ${MAX_ROLES_PER_SEARCH}. Empty when the request names no role.
- keywords: technologies, skills or specialties the request names. Empty when none.
- location: the city or region named, or an empty string.
- country: ISO 3166-1 alpha-2 code (for example "NL", "DE") when a country is named or clearly implied, otherwise an empty string.
- remote: one of "any", "remote", "hybrid", "onsite". Use "any" unless the request says otherwise.
- datePosted: one of "any", "24h", "week", "month". Use "any" unless the request asks for recent postings.
- Keep the wording of the request. Do not invent filters it does not mention.
- Today is ${today}.

Request:
"""
${clip(query, MAX_INPUT_CHARS)}
"""

Return exactly this shape:
{"roles":[""],"keywords":[""],"location":"","country":"","remote":"any","datePosted":"any"}`;
}
