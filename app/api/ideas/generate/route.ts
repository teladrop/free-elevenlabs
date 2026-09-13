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
  angle: string;
  hook: string;
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

    const connected = await provider.validateConnection();
    if (!connected) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot reach OpenRouter. Check OPENROUTER_API_KEY in .env.local.',
        } as ApiResponse<null>,
        { status: 503 },
      );
    }

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
        ideas = Array.isArray(parsed) ? (parsed as ContentIdea[]).slice(0, count) : [];
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

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Category header
    if (line.endsWith(':') && !line.startsWith('-') && !line.startsWith('*')) {
      currentCategory = line.replace(/:$/, '').replace(/^\d+\.\s*/, '');
    } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
      if (text) {
        ideas.push({
          category: currentCategory || 'General',
          angle: text,
          hook: text.slice(0, 120),
          value: 'Original angle',
          visualPotential:       Math.floor(Math.random() * 3) + 7,
          searchability:         Math.floor(Math.random() * 3) + 6,
          storytellingPotential: Math.floor(Math.random() * 3) + 7,
        });
      }
    }
  }

  return ideas.slice(0, limit);
}
