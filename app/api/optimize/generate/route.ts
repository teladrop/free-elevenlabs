import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { ApiResponse } from '@/lib/types';

export const dynamic    = 'force-dynamic';
export const maxDuration = 90;

export interface OptimizeResult {
  /** SEO-optimised video title (max 70 chars) */
  title: string;
  /** Three title alternatives */
  titleAlternatives: string[];
  /** Keyword-optimised description (300–400 words) with timestamps placeholder */
  description: string;
  /** 15–20 tags ordered by relevance */
  tags: string[];
  /** Thumbnail concept — detailed visual prompt for Midjourney / DALL-E */
  thumbnailPrompt: string;
  /** Three thumbnail text overlay suggestions (short, punchy) */
  thumbnailText: string[];
  /** Primary keyword to target */
  primaryKeyword: string;
  /** 5–8 secondary keywords */
  secondaryKeywords: string[];
}

export interface OptimizeRequest {
  topic: string;
  niche?: string;
  hook?: string;
  value?: string;
  script?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as OptimizeRequest;
    const { topic, niche = '', hook = '', value = '', script = '' } = body;

    if (!topic?.trim()) {
      return NextResponse.json(
        { success: false, error: 'topic is required' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider = getDefaultProvider();

    const prompt = `You are a YouTube SEO expert. Generate a complete optimisation package for a YouTube video.

VIDEO TOPIC: "${topic}"
NICHE / SEARCH QUERY: "${niche || topic}"
HOOK: "${hook}"
VALUE PROPOSITION: "${value}"
${script ? `SCRIPT EXCERPT (first 500 chars): "${script.slice(0, 500)}"` : ''}

Return ONLY valid JSON matching this exact structure (no markdown, no backticks):
{
  "title": "SEO-optimised title, max 70 chars, includes primary keyword, creates curiosity",
  "titleAlternatives": [
    "Alternative title 1 — different angle",
    "Alternative title 2 — question format",
    "Alternative title 3 — number/list format"
  ],
  "description": "Full YouTube description, 300-400 words. Start with the hook. Include the primary keyword in first 2 sentences. Add 3-5 timestamps as [00:00] Intro, [01:30] Section etc. Add a call to action. End with 3-5 relevant hashtags like #YouTube #ContentCreator.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8", "tag9", "tag10", "tag11", "tag12", "tag13", "tag14", "tag15"],
  "thumbnailPrompt": "Detailed Midjourney/DALL-E prompt for the thumbnail. Describe: main subject, expression, background, text overlay position, color palette, lighting style, camera angle. Make it click-worthy and high contrast.",
  "thumbnailText": [
    "Short punchy overlay text option 1 (3-5 words)",
    "Short punchy overlay text option 2 (3-5 words)",
    "Short punchy overlay text option 3 (3-5 words)"
  ],
  "primaryKeyword": "single best keyword to rank for",
  "secondaryKeywords": ["keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]
}

Rules:
- Title must be under 70 characters and naturally include the primary keyword
- Tags: mix of broad (2-3 words) and specific (4-6 words), no duplicates, all lowercase
- Description must feel natural, not keyword-stuffed
- Thumbnail prompt must be photorealistic or cinematic quality
- Return ONLY the JSON object, nothing else`;

    const response = await provider.generate(prompt, {
      task: 'analysis',
      temperature: 0.7,
      maxTokens: 2500,
    });

    // Parse JSON from response
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { success: false, error: 'AI returned invalid format' } as ApiResponse<null>,
        { status: 502 },
      );
    }

    const result: OptimizeResult = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!result.title || !result.description || !result.tags?.length) {
      return NextResponse.json(
        { success: false, error: 'Incomplete AI response' } as ApiResponse<null>,
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Optimisation failed';
    console.error('[/api/optimize/generate]', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
