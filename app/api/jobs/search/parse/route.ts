import { NextResponse } from 'next/server';
import { getAIProvider } from '@/lib/ai/openai-compatible';
import {
  buildSearchQueryPrompt,
  normalizeSearchQuery,
  SearchQuerySchema,
} from '@/lib/jobs/search-strategy';

const MAX_QUERY_CHARS = 2000;

/** POST /api/jobs/search/parse — read a natural-language search request and return search filters. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { query?: unknown };
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ error: 'Describe the jobs you are looking for' }, { status: 400 });
  }
  if (query.length > MAX_QUERY_CHARS) {
    return NextResponse.json({ error: 'Search request is too long (max 2,000 characters)' }, { status: 422 });
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    const ai = await getAIProvider();
    const parsed = await ai.generateStructured(buildSearchQueryPrompt(query, today), SearchQuerySchema, {
      temperature: 0,
      maxTokens: 800,
      systemPrompt:
        'You convert job search requests into structured filters. Output only a complete valid JSON object matching the schema. No markdown and no prose.',
    });

    return NextResponse.json({ success: true, query: normalizeSearchQuery(parsed) });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'The AI could not read this search request' },
      { status: 502 },
    );
  }
}
