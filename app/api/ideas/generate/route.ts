import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildIdeaGenerationPrompt } from '@/lib/ai/prompts';
import { ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

interface GenerateIdeasRequest {
  topic: string;
  researchPatterns?: string;
  count?: number;
}

export interface ContentIdea {
  category: string;
  title: string;   // the video title — shown as heading
  angle: string;   // kept for backward compat = same as title
  hook: string;    // opening line — different from title
  value: string;
  visualPotential: number;
  searchability: number;
  storytellingPotential: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateIdeasRequest;
    const { topic, researchPatterns, count = 50 } = body;

    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider = getDefaultProvider();

    const prompt = buildIdeaGenerationPrompt(
      topic,
      researchPatterns || 'No research patterns available',
    );
    const response = await provider.generate(prompt, {
      task: 'ideas',
      temperature: 0.95,
      maxTokens: 4000,
    });

    // Try structured JSON first
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    let ideas: ContentIdea[] = [];

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          ideas = parsed
            .map((item: any) => ({
              category:              String(item.category || 'General').trim(),
              // Support both "title" (new prompt) and "angle" (old prompt)
              title:                 String(item.title || item.angle || '').trim(),
              angle:                 String(item.title || item.angle || '').trim(),
              hook:                  String(item.hook || '').trim(),
              value:                 String(item.value || '').trim(),
              visualPotential:       Number(item.visualPotential)       || 7,
              searchability:         Number(item.searchability)         || 7,
              storytellingPotential: Number(item.storytellingPotential) || 7,
            }))
            // Drop any item where title equals category (the main bug)
            .filter(idea =>
              idea.title.length > 5 &&
              idea.title.toLowerCase() !== idea.category.toLowerCase() &&
              idea.hook.toLowerCase() !== idea.title.toLowerCase()
            )
            .slice(0, count);
        }
      } catch {
        ideas = parseIdeasFromText(response.text, count);
      }
    } else {
      ideas = parseIdeasFromText(response.text, count);
    }

    return NextResponse.json({
      success: true,
      data: { ideas, count: ideas.length, topic, model: response.model },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Ideas generation failed';
    console.error('[ideas/generate]', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}

function parseIdeasFromText(text: string, limit: number): ContentIdea[] {
  const ideas: ContentIdea[] = [];
  let currentCategory = '';

  const CATEGORY_NAMES = new Set([
    'unusual angle', 'curiosity', 'business', 'documentary', 'explainer',
    'personal story', 'contrarian', 'technical', 'how & why', 'trending',
    'unusual angles', 'curiosity-driven', 'business angles', 'documentary angles',
    'explainer angles', 'personal story angles', 'contrarian angles',
    'technical deep-dives', 'emerging trends', 'general',
  ]);

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect category header: ends with ":" or is a numbered section heading
    const isHeader =
      (line.endsWith(':') && !line.startsWith('-') && !line.startsWith('*')) ||
      /^\d+\.\s+[A-Z]/.test(line);

    if (isHeader) {
      currentCategory = line
        .replace(/:$/, '')
        .replace(/^\d+\.\s*/, '')
        .replace(/\*{1,2}/g, '')
        .trim();
      continue;
    }

    // List item
    if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ') || /^\d+\.\s/.test(line)) {
      const raw = line
        .replace(/^[-*•]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
        .trim();

      if (!raw || raw.length < 6) continue;

      // Reject lines that are just restating the category name
      const lower = raw.toLowerCase().replace(/[^a-z0-9 ]/g, '');
      if (CATEGORY_NAMES.has(lower)) continue;

      // Split on " - " or " | " to separate title from hook if present
      const parts = raw.split(/\s+[-–|]\s+/);
      const title = parts[0].trim();
      const hook  = parts[1]?.trim() || '';

      ideas.push({
        category:              currentCategory || 'General',
        title,
        angle:                 title,
        hook:                  hook || `Explore ${title} from a fresh angle.`,
        value:                 'Original content angle',
        visualPotential:       7,
        searchability:         7,
        storytellingPotential: 7,
      });
    }
  }

  return ideas.slice(0, limit);
}
