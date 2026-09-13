import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildTitleGenerationPrompt } from '@/lib/ai/prompts';
import { ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface GenerateTitlesRequest {
  topic: string;
  researchData?: string;
  count?: number;
}

interface TitleCategory {
  category: string;
  titles: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateTitlesRequest;
    const { topic, researchData, count = 30 } = body;

    if (!topic) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider = getDefaultProvider();

    const prompt = buildTitleGenerationPrompt(topic, researchData || 'No research data provided');
    const response = await provider.generate(prompt, {
      task: 'titles',
      temperature: 0.9,
      maxTokens: 2500,
    });

    // Parse category blocks from the text
    const categories: TitleCategory[] = [];
    let currentCategory = '';
    let currentTitles: string[] = [];

    for (const rawLine of response.text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      // Category header: ends with ":" and not a list item
      if (line.endsWith(':') && !line.startsWith('-') && !line.startsWith('*')) {
        if (currentCategory && currentTitles.length > 0) {
          categories.push({ category: currentCategory, titles: currentTitles });
        }
        currentCategory = line.replace(/:$/, '').replace(/^\d+\.\s*/, '');
        currentTitles   = [];
      } else if (line.startsWith('- ') || line.startsWith('* ') || /^\d+\.\s/.test(line)) {
        const title = line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
        if (title) currentTitles.push(title);
      }
    }
    if (currentCategory && currentTitles.length > 0) {
      categories.push({ category: currentCategory, titles: currentTitles });
    }

    const allTitles = categories.flatMap(c => c.titles).slice(0, count);

    return NextResponse.json({
      success: true,
      data: {
        titles: allTitles,
        byCategory: categories,
        count: allTitles.length,
        model: response.model,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Title generation failed';
    console.error('[titles/generate]', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
