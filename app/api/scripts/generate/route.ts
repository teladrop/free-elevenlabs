import { NextRequest, NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';
import {
  buildScriptPrompt,
  buildScriptAnalysisPrompt,
  buildScriptRewritePrompt,
  buildExternalScriptRewritePrompt,
  buildScriptFixPrompt,
} from '@/lib/ai/prompts';
import { ScriptGenerationParams, ScriptAnalysis, ApiResponse } from '@/lib/types';
import { updateProjectScript } from '@/lib/db/projects';

export const dynamic     = 'force-dynamic';
export const maxDuration = 180;

interface GenerateBody {
  mode?:           'generate' | 'rewrite' | 'fix';
  projectId?:      string;
  params:          ScriptGenerationParams;
  analyzeAndRewrite?: boolean;
  externalScript?: string;
  analysis?:       ScriptAnalysis;
}

// ── Helper: run analysis and return parsed JSON ────────────────────────────────
async function runAnalysis(
  provider: Awaited<ReturnType<typeof getDefaultProvider>>,
  script: string,
): Promise<ScriptAnalysis | null> {
  try {
    const res = await provider.generate(buildScriptAnalysisPrompt(script), {
      task: 'analysis', maxTokens: 1500,
    });
    // Strip any markdown fences the model might add
    const cleaned = res.text.replace(/```json|```/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as ScriptAnalysis;
  } catch (err) {
    console.error('[scripts/generate] analysis failed:', err);
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    const {
      mode = 'generate',
      projectId,
      params,
      analyzeAndRewrite = true,   // default ON
      externalScript,
      analysis: incomingAnalysis,
    } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (mode === 'rewrite' && !externalScript?.trim()) {
      return NextResponse.json(
        { success: false, error: 'externalScript is required for rewrite mode' } as ApiResponse<null>,
        { status: 400 },
      );
    }
    if (mode === 'fix' && (!externalScript?.trim() || !incomingAnalysis)) {
      return NextResponse.json(
        { success: false, error: 'externalScript and analysis are required for fix mode' } as ApiResponse<null>,
        { status: 400 },
      );
    }
    if (mode === 'generate' && !params?.topic?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Topic is required' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider  = getDefaultProvider();
    const connected = await provider.validateConnection();
    if (!connected) {
      return NextResponse.json(
        { success: false, error: 'No AI provider reachable. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local.' } as ApiResponse<null>,
        { status: 503 },
      );
    }

    let finalScript = '';
    let analysis:    ScriptAnalysis | null = null;

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: FIX — apply analysis suggestions to existing script
    // ══════════════════════════════════════════════════════════════════════════
    if (mode === 'fix') {
      console.log('[scripts/generate] mode=fix');
      const fixPrompt  = buildScriptFixPrompt(
        externalScript!,
        incomingAnalysis as unknown as Record<string, unknown>,
        params,
      );
      const fixResp    = await provider.generate(fixPrompt, { task: 'script', temperature: 0.75, maxTokens: 4000 });
      finalScript      = fixResp.text.trim();

      // Always re-analyse after fix so scores reflect the improved script
      analysis = await runAnalysis(provider, finalScript);

      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

      return NextResponse.json({
        success: true,
        data: { script: finalScript, analysis, wordCount: finalScript.split(/\s+/).length },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: REWRITE — user pastes external script, AI rewrites retention-first
    // ══════════════════════════════════════════════════════════════════════════
    if (mode === 'rewrite') {
      console.log('[scripts/generate] mode=rewrite');
      const rwPrompt  = buildExternalScriptRewritePrompt(externalScript!, params);
      const rwResp    = await provider.generate(rwPrompt, { task: 'script', temperature: 0.8, maxTokens: 4000 });
      finalScript     = rwResp.text.trim();

      // Always analyse rewrites
      analysis = await runAnalysis(provider, finalScript);

      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

      return NextResponse.json({
        success: true,
        data: { script: finalScript, analysis, wordCount: finalScript.split(/\s+/).length },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: GENERATE — fresh script on topic, with retention auto-fix loop
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`[scripts/generate] mode=generate topic="${params.topic}"`);

    // ── Step 1: Generate initial script ──────────────────────────────────────
    const scriptPrompt = buildScriptPrompt(params);
    const scriptResp   = await provider.generate(scriptPrompt, {
      task: 'script', temperature: 0.8, maxTokens: 4000,
    });
    finalScript = scriptResp.text.trim();
    console.log(`[scripts/generate] initial script: ${finalScript.split(/\s+/).length} words`);

    // ── Step 2: Always analyse (whether user toggled it or not) ───────────────
    analysis = await runAnalysis(provider, finalScript);
    console.log(`[scripts/generate] initial score: ${analysis?.overallScore ?? 'n/a'}`);

    // ── Step 3: Retention auto-rewrite when analysis is on ────────────────────
    // Fires if ANY of these are weak — much lower threshold than before
    if (analyzeAndRewrite && analysis) {
      const a = analysis as unknown as Record<string, number>;

      const weakAreas: string[] = [];
      if ((a.hookStrength         ?? 10) < 8) weakAreas.push('Hook is weak — rewrite the first sentence to be more gripping and specific');
      if ((a.curiosity            ?? 10) < 8) weakAreas.push('Not enough curiosity gaps — add 2–3 open loops that tease a reveal');
      if ((a.pacing               ?? 10) < 8) weakAreas.push('Pacing is flat — add punchy 5-word sentences to break up long paragraphs');
      if ((a.predictability       ??  0) > 3) weakAreas.push('Too predictable — add at least one counterintuitive or surprising fact');
      if ((a.ttsReadability       ?? 10) < 8) weakAreas.push('Hard to read aloud — shorten sentences over 25 words');
      if ((a.narrativeProgression ?? 10) < 8) weakAreas.push('Weak arc — raise the stakes or tension in the middle section');
      if ((a.endingStrength       ?? 10) < 8) weakAreas.push('Weak ending — rewrite to deliver on the hook\'s promise');
      if ((a.informationDensity   ?? 10) < 7) weakAreas.push('Too much padding — cut filler, every sentence must carry new information');

      if (weakAreas.length > 0) {
        console.log(`[scripts/generate] rewriting — ${weakAreas.length} weak areas`);

        // Pass full params so rewrite stays on topic and includes CTA
        const rwPrompt  = buildScriptRewritePrompt(
          finalScript,
          analysis as unknown as Record<string, unknown>,
          weakAreas,
          params,
        );
        const rwResp    = await provider.generate(rwPrompt, {
          task: 'script', temperature: 0.75, maxTokens: 4000,
        });
        finalScript     = rwResp.text.trim();
        console.log(`[scripts/generate] rewritten: ${finalScript.split(/\s+/).length} words`);

        // Re-analyse final version so UI shows updated scores
        const finalAnalysis = await runAnalysis(provider, finalScript);
        if (finalAnalysis) analysis = finalAnalysis;
        console.log(`[scripts/generate] final score: ${analysis?.overallScore ?? 'n/a'}`);
      } else {
        console.log('[scripts/generate] no rewrite needed — all scores good');
      }
    }

    if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

    return NextResponse.json({
      success: true,
      data: {
        script:            finalScript,
        analysis,
        wordCount:         finalScript.split(/\s+/).length,
        estimatedDuration: Math.round(finalScript.split(/\s+/).length / 140),
        model:             scriptResp.model,
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
