import { NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/openai-compatible';
import { prisma } from '@/lib/prisma';
import {
  buildStrategyPrompt,
  normalizeLocations,
  normalizeRoleSuggestions,
  parseStringList,
  RoleStrategySchema,
} from '@/lib/jobs/search-strategy';

/** POST /api/jobs/search/strategy — suggest search roles and locations from the candidate's CV and profile. */
export async function POST() {
  const [profile, preferences, cv] = await Promise.all([
    prisma.userProfile.findFirst({ where: { id: 'default' } }),
    prisma.jobPreference.findFirst({ where: { id: 'default' } }),
    prisma.cV.findFirst({ where: { isActive: true }, orderBy: { uploadDate: 'desc' } }),
  ]);

  const cvText = cv?.extractedText?.trim() ?? '';
  const skills = parseStringList(profile?.skills);
  const technologies = parseStringList(profile?.technologies);
  const hasCandidateData = Boolean(cvText || profile?.currentTitle || skills.length || technologies.length);
  if (!hasCandidateData) {
    return NextResponse.json(
      { error: 'Upload your CV or fill in your profile first' },
      { status: 422 },
    );
  }

  let workExperience: unknown = [];
  try {
    workExperience = JSON.parse(profile?.workExperience || '[]');
  } catch {
    workExperience = [];
  }

  const prompt = buildStrategyPrompt({
    currentTitle: profile?.currentTitle ?? '',
    yearsExperience: profile?.yearsExperience ?? 0,
    city: profile?.city ?? '',
    country: profile?.country ?? '',
    skills,
    technologies,
    languages: parseStringList(profile?.languages),
    workExperience,
    cvText,
    remotePreference: preferences?.remotePreference ?? 'any',
    employmentTypes: parseStringList(preferences?.employmentTypes),
    preferredLocations: parseStringList(preferences?.locations),
    excludedKeywords: parseStringList(preferences?.excludedKeywords),
  });

  try {
    const ai = await getAIProvider();
    const result = await ai.generateStructured(prompt, RoleStrategySchema, {
      temperature: 0.3,
      maxTokens: 1500,
      systemPrompt:
        'You are a career advisor who suggests realistic job titles and search keywords. Output only a complete valid JSON object matching the schema. No markdown and no prose.',
    });

    const roles = normalizeRoleSuggestions(result.roles as Array<{ title: unknown; keywords?: unknown }>);
    if (roles.length === 0) {
      return NextResponse.json(
        { error: 'The AI did not suggest any roles. Try again or add more to your profile.' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      roles,
      locations: normalizeLocations(result.locations),
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Could not generate search suggestions' },
      { status: 502 },
    );
  }
}
