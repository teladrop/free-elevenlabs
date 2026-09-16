import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildVisualPromptPrompt } from '@/lib/ai/prompts';
import { VisualStyle, ApiResponse, ScriptLine } from '@/lib/types';
import { updateProjectLines } from '@/lib/db/projects';

export const dynamic    = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max

// ── Tuning ────────────────────────────────────────────────────────────────────
// Lower concurrency = fewer simultaneous requests = less likely to hit rate limits
const CONCURRENT_REQUESTS = 2;

// Short retry delay — Groq/Gemini rate-limit windows are usually per-minute
// We only retry once with a short delay to stay within the 5-min timeout
const MAX_RETRIES   = 1;
const RETRY_DELAY_MS = 8000; // 8 seconds between retries

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Detect rate-limit errors from any provider
function isRateLimitError(msg: string): boolean {
  return (
    msg.includes('rate limit') ||
    msg.includes('Rate limit') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('quota')
  );
}

// ── Request shape ─────────────────────────────────────────────────────────────
interface GenerateVisualsRequest {
  projectId?:      string;
  scriptLines:     string[];
  visualStyle:     VisualStyle;
  visualBible:     string;
  generateIndices?: number[];
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateVisualsRequest;
    const { projectId, scriptLines, visualStyle, visualBible, generateIndices } = body;

    if (!scriptLines?.length) {
      return NextResponse.json(
        { success: false, error: 'No script lines provided' } as ApiResponse<null>,
        { status: 400 },
      );
    }
    if (!visualStyle) {
      return NextResponse.json(
        { success: false, error: 'Visual style is required' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider  = getDefaultProvider();
    const toGenerate = generateIndices ?? Array.from({ length: scriptLines.length }, (_, i) => i);

    // ── Generate one line with retry ─────────────────────────────────────────
    const generateLine = async (i: number, text: string): Promise<ScriptLine> => {
      // Not in requested set — return as-is
      if (!toGenerate.includes(i)) {
        return { id: `line_${i}`, index: i, text };
      }

      let lastError = '';

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          console.log(`[visuals] Line ${i} retry ${attempt} after ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
        }

        try {
          const prompt = buildVisualPromptPrompt(text, visualStyle, visualBible);
          console.log(`[visuals] Line ${i} attempt ${attempt + 1}: "${text.substring(0, 40)}..."`);

          const response = await provider.generate(prompt, {
            task:        'visual',
            temperature: 0.7,
            maxTokens:   300, // plain text only — 300 tokens is plenty for 80 words
          });

          // Strip any accidental JSON wrappers, markdown fences, or "prompt:" labels
          // that some models add despite instructions
          let promptText = response.text.trim();
          promptText = promptText.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '').trim();
          promptText = promptText.replace(/^\{[\s\S]*?"prompt"\s*:\s*"/i, '').replace(/"\s*,[\s\S]*\}[\s\S]*$/, '').trim();
          promptText = promptText.replace(/^(visual prompt|prompt)\s*:\s*/i, '').trim();
          promptText = promptText.replace(/^["']|["']$/g, '').trim();

          // Fallback if empty after stripping
          if (!promptText) {
            promptText = `Visual scene for: ${text.trim()}`;
          }

          console.log(`[visuals] Line ${i} OK (${response.model}): "${promptText.substring(0, 60)}..."`);

          return {
            id:           `line_${i}`,
            index:        i,
            text,
            visualPrompt: promptText,
            visualStyle,
            duration:     4,
          };
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
          console.warn(`[visuals] Line ${i} attempt ${attempt + 1} failed: ${lastError}`);

          // Only retry on rate-limit errors
          if (!isRateLimitError(lastError)) break;
        }
      }

      // All attempts failed — return a placeholder so the line still shows
      console.error(`[visuals] Line ${i} gave up: ${lastError}`);
      return {
        id:           `line_${i}`,
        index:        i,
        text,
        visualStyle,
        // Store error in visualPrompt — UI will show it
        visualPrompt: `❌ ${lastError || 'Generation failed'}`,
      };
    };

    // ── Process in parallel batches ──────────────────────────────────────────
    const visualLines: ScriptLine[] = [];

    for (let start = 0; start < scriptLines.length; start += CONCURRENT_REQUESTS) {
      const end   = Math.min(start + CONCURRENT_REQUESTS, scriptLines.length);
      const batch = scriptLines.slice(start, end);

      console.log(`[visuals] Batch ${start}–${end - 1} / ${scriptLines.length}`);

      const results = await Promise.all(
        batch.map((text, idx) => generateLine(start + idx, text)),
      );
      visualLines.push(...results);
    }

    if (projectId) {
      await updateProjectLines(projectId, visualLines as unknown as Record<string, unknown>[]);
    }

    // Count only real prompts (not error strings)
    const generatedCount = visualLines.filter(
      l => l.visualPrompt && !l.visualPrompt.startsWith('❌'),
    ).length;

    console.log(`[visuals] Done: ${generatedCount}/${visualLines.length} prompts generated`);

    return NextResponse.json({
      success: true,
      data: { lines: visualLines, count: visualLines.length, generatedCount },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Visual generation failed';
    console.error('[visuals/generate] Fatal error:', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
