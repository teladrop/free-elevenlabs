import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import { buildScriptPrompt, buildScriptAnalysisPrompt, buildScriptRewritePrompt } from '@/lib/ai/prompts';
import { ScriptGenerationParams, ApiResponse } from '@/lib/types';
import { updateProjectScript } from '@/lib/db/projects';

export const dynamic = 'force-dynamic';
// Long-running: give the model time to write a full script
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      params,
      analyzeAndRewrite,
    }: {
      projectId?: string;
      params: ScriptGenerationParams;
      analyzeAndRewrite?: boolean;
    } = body;

    if (!params?.topic || !params?.contentType) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters: topic, contentType' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider = getDefaultProvider();

    // Validate key / connection first
    const connected = await provider.validateConnection();
    if (!connected) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Cannot reach OpenRouter. Check that OPENROUTER_API_KEY is set in .env.local and restart the dev server.',
        } as ApiResponse<null>,
        { status: 503 },
      );
    }

    // ── Step 1: Generate script ───────────────────────────────────────────────
    const scriptPrompt = buildScriptPrompt(params);
    const scriptResponse = await provider.generate(scriptPrompt, {
      task: 'script',
      temperature: 0.8,
      maxTokens: 4000,
    });

    let finalScript = scriptResponse.text.trim();

    // ── Step 2: Analyse + rewrite (optional) ──────────────────────────────────
    let analysis = null;
    if (analyzeAndRewrite) {
      try {
        // Analysis uses DeepSeek-R1 reasoning model
        const analysisPrompt = buildScriptAnalysisPrompt(finalScript);
        const analysisResponse = await provider.generate(analysisPrompt, {
          task: 'analysis',
          maxTokens: 1200,
        });

        const jsonMatch = analysisResponse.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysis = JSON.parse(jsonMatch[0]);

          const weakAreas: string[] = [];
          if (analysis.hookStrength      < 6) weakAreas.push('Hook is weak — needs a more compelling opening');
          if (analysis.curiosity         < 6) weakAreas.push('Lacks curiosity gaps and open loops');
          if (analysis.pacing            < 6) weakAreas.push('Pacing is flat — vary sentence length more');
          if (analysis.predictability    > 5) weakAreas.push('Too predictable — add surprising elements');
          if (analysis.ttsReadability    < 7) weakAreas.push('Hard to read aloud — simplify sentence structure');
          if (analysis.narrativeProgression < 6) weakAreas.push('Weak narrative arc — escalate earlier');

          if (weakAreas.length > 0) {
            const rewritePrompt = buildScriptRewritePrompt(finalScript, analysis, weakAreas);
            const rewriteResponse = await provider.generate(rewritePrompt, {
              task: 'script',
              temperature: 0.75,
              maxTokens: 4000,
            });
            finalScript = rewriteResponse.text.trim();

            // Re-analyse the rewritten version
            const reanalysisResponse = await provider.generate(
              buildScriptAnalysisPrompt(finalScript),
              { task: 'analysis', maxTokens: 1200 },
            );
            const reMath = reanalysisResponse.text.match(/\{[\s\S]*\}/);
            if (reMath) analysis = JSON.parse(reMath[0]);
          }
        }
      } catch (err) {
        // Analysis failure is non-fatal — continue with the generated script
        console.error('[scripts/generate] analysis step failed:', err);
      }
    }

    if (projectId) {
      await updateProjectScript(projectId, finalScript, analysis);
    }

    return NextResponse.json({
      success: true,
      data: {
        script: finalScript,
        analysis,
        wordCount: finalScript.split(/\s+/).length,
        estimatedDuration: Math.round(finalScript.split(/\s+/).length / 140),
        model: scriptResponse.model,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Script generation failed';
    console.error('[scripts/generate]', error);
    return NextResponse.json(
      { success: false, error: msg } as ApiResponse<null>,
      { status: 500 },
    );
  }
}
