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

// ─── Title sanitiser ──────────────────────────────────────────────────────────
// Strips model artefacts so only the plain title string remains.

function cleanTitle(raw: string): string | null {
  let t = raw.trim();

  // Remove leading list markers: "- ", "* ", "1. ", "1) "
  t = t.replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '').trim();

  // Strip markdown bold/italic (**text** or *text*)
  t = t.replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1').trim();

  // Strip inline parenthetical annotations the model adds after the title
  // e.g. "The IKEA Effect (curiosity)" or "Title (48 chars)"
  t = t.replace(/\s*\([^)]*\)\s*$/, '').trim();

  // Strip inline bracket annotations
  t = t.replace(/\s*\[[^\]]*\]\s*$/, '').trim();

  // Strip surrounding quotes
  t = t.replace(/^["'"']|["'"']$/g, '').trim();

  // Reject if empty after cleaning
  if (!t) return null;

  // Reject if it looks like a category header (ends with ":" or starts with a digit + ".")
  if (t.endsWith(':')) return null;
  if (/^\d+\.\s+[A-Z]/.test(t) && t.includes(':')) return null;

  // Reject meta-commentary lines (common model mistakes)
  const lower = t.toLowerCase();
  const REJECT_PATTERNS = [
    /^(note|tip|hint|example|output|format|remember|important)[:—]/i,
    /^\[.*\]$/,                        // pure bracket content
    /^title \d+/i,                     // "Title 1", "Title 2"
    /characters?\b/,                   // "48 characters", "under 60 chars"
    /^count:/i,
    /^approach \d+/i,
    /^\(.*\)$/,                        // pure parenthetical
  ];
  if (REJECT_PATTERNS.some(r => r.test(t))) return null;

  // Reject lines that are clearly too short (≤3 chars) or too long (>120 chars)
  if (t.length <= 3 || t.length > 120) return null;

  return t;
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

    // ── Parse category blocks ────────────────────────────────────────────────
    const categories: TitleCategory[] = [];
    let currentCategory = '';
    let currentTitles: string[] = [];

    for (const rawLine of response.text.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;

      // Category header: ends with ":" and is not a list item
      const isListItem = line.startsWith('-') || line.startsWith('*') || line.startsWith('•') || /^\d+[.)]\s/.test(line);
      if (!isListItem && line.endsWith(':')) {
        if (currentCategory && currentTitles.length > 0) {
          categories.push({ category: currentCategory, titles: currentTitles });
        }
        // Clean up the category name
        currentCategory = line
          .replace(/:$/, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/\*{1,2}/g, '')
          .trim();
        currentTitles = [];
        continue;
      }

      // List item — extract and clean the title
      if (isListItem) {
        const cleaned = cleanTitle(line);
        if (cleaned) currentTitles.push(cleaned);
      }
    }

    // Push the last category
    if (currentCategory && currentTitles.length > 0) {
      categories.push({ category: currentCategory, titles: currentTitles });
    }

    // If parsing produced nothing (model formatted differently), try a flat extraction
    if (categories.length === 0) {
      const flatTitles: string[] = [];
      for (const rawLine of response.text.split('\n')) {
        const cleaned = cleanTitle(rawLine);
        if (cleaned) flatTitles.push(cleaned);
      }
      if (flatTitles.length > 0) {
        categories.push({ category: 'Generated Titles', titles: flatTitles.slice(0, count) });
      }
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
