import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildVisualPromptPrompt } from '@/lib/ai/prompts';
import { VisualStyle, ApiResponse, ScriptLine } from '@/lib/types';
import { updateProjectLines } from '@/lib/db/projects';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // visual prompts run line-by-line — allow up to 5 min

// Process lines in parallel batches to avoid timeouts
const CONCURRENT_REQUESTS = 3; // Process 3 lines at once

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

    // Helper function to generate a single line
    const generateLine = async (i: number, text: string): Promise<ScriptLine> => {
      // Skip lines not in the requested set
      if (!toGenerate.includes(i)) {
        return { id: `line_${i}`, index: i, text };
      }

      // Generate prompts for ALL lines, no matter how short
      try {
        const prompt = buildVisualPromptPrompt(text, visualStyle, visualBible);
        console.log(`[visuals/generate] Generating prompt for line ${i}:`, text.substring(0, 50));
        
        const response = await provider.generate(prompt, {
          task: 'visual',
          temperature: 0.7,
          maxTokens: 600,
        });
        
        console.log(`[visuals/generate] Line ${i} response:`, response.text.substring(0, 100));

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
            console.log(`[visuals/generate] Line ${i} parsed prompt:`, promptText.substring(0, 80));
          } catch (parseErr) {
            console.log(`[visuals/generate] Line ${i} JSON parse failed, using raw text`);
          }
        } else {
          console.log(`[visuals/generate] Line ${i} no JSON found, using raw text`);
        }

        return {
          id: `line_${i}`,
          index: i,
          text,
          visualPrompt: promptText,
          visualStyle,
          duration,
          motionPrompt,
        };
      } catch (lineErr) {
        // Never fail the whole batch because one line errored
        const errMsg = lineErr instanceof Error ? lineErr.message : 'Unknown error';
        console.error(`[visuals/generate] line ${i} failed:`, errMsg);
        
        // Include error message in the line so the UI can show it
        return { 
          id: `line_${i}`, 
          index: i, 
          text, 
          visualStyle,
          visualPrompt: `❌ Error: ${errMsg}`,
        };
      }
    };

    // Process lines in parallel batches to avoid overwhelming the API
    const visualLines: ScriptLine[] = [];
    for (let batchStart = 0; batchStart < scriptLines.length; batchStart += CONCURRENT_REQUESTS) {
      const batchEnd = Math.min(batchStart + CONCURRENT_REQUESTS, scriptLines.length);
      const batch = scriptLines.slice(batchStart, batchEnd);
      
      console.log(`[visuals/generate] Processing batch ${batchStart}-${batchEnd-1} of ${scriptLines.length}`);
      
      // Process this batch in parallel
      const batchPromises = batch.map((text, localIdx) => 
        generateLine(batchStart + localIdx, text)
      );
      
      const batchResults = await Promise.all(batchPromises);
      visualLines.push(...batchResults);
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
