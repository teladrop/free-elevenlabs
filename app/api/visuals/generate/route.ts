import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildVisualPromptPrompt } from '@/lib/ai/prompts';
import { VisualStyle, ApiResponse, ScriptLine } from '@/lib/types';
import { updateProjectLines } from '@/lib/db/projects';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // visual prompts run line-by-line — allow up to 5 min

interface GenerateVisualsRequest {
  projectId?: string;
  scriptLines: string[];
  visualStyle: VisualStyle;
  visualBible: string;
  generateIndices?: number[];
}

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

    const provider = getDefaultProvider();

    // Skip validateConnection — it's a separate /models round-trip that adds
    // latency and can cause the serverless function to return a plain-text
    // timeout error before our JSON wrapper catches it.
    // The generate() call itself will throw a clear error if the key is wrong.

    // Indices to generate — default to all
    const toGenerate =
      generateIndices ?? Array.from({ length: scriptLines.length }, (_, i) => i);

    const visualLines: ScriptLine[] = [];

    for (let i = 0; i < scriptLines.length; i++) {
      const text = scriptLines[i];

      // Skip lines not in the requested set
      if (!toGenerate.includes(i)) {
        visualLines.push({ id: `line_${i}`, index: i, text });
        continue;
      }

      // Empty / very short lines get a placeholder rather than a wasted API call
      if (text.trim().length < 6) {
        visualLines.push({ id: `line_${i}`, index: i, text, visualStyle });
        continue;
      }

      try {
        const prompt = buildVisualPromptPrompt(text, visualStyle, visualBible);
        const response = await provider.generate(prompt, {
          task: 'visual',
          temperature: 0.7,
          maxTokens: 600,
        });

        // Try to parse structured JSON from model response
        const jsonMatch = response.text.match(/\{[\s\S]*?\}/);
        let promptText = response.text.trim();
        let duration   = 4;
        let motionPrompt: string | undefined;

        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
            promptText   = (parsed.prompt as string)          || promptText;
            motionPrompt = (parsed.motionSuggestion as string) || undefined;
            const durStr = (parsed.duration as string) || '4';
            duration     = parseInt(durStr.split(/[-–]/)[0]) || 4;
          } catch {
            // Fall back to raw text as the prompt
          }
        }

        visualLines.push({
          id: `line_${i}`,
          index: i,
          text,
          visualPrompt: promptText,
          visualStyle,
          duration,
          motionPrompt,
        });
      } catch (lineErr) {
        // Never fail the whole batch because one line errored
        console.error(`[visuals/generate] line ${i} failed:`, lineErr);
        visualLines.push({ id: `line_${i}`, index: i, text, visualStyle });
      }
    }

    if (projectId) {
      await updateProjectLines(projectId, visualLines as Record<string, unknown>[]);
    }

    return NextResponse.json({
      success: true,
      data: {
        lines: visualLines,
        count: visualLines.length,
        generatedCount: visualLines.filter(l => l.visualPrompt).length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Visual generation failed';
    console.error('[visuals/generate]', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
