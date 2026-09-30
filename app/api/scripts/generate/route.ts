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
  mode?:            'generate' | 'rewrite' | 'fix';
  projectId?:       string;
  params:           ScriptGenerationParams;
  analyzeAndRewrite?: boolean;
  externalScript?:  string;
  analysis?:        ScriptAnalysis;
}

// ── Robust analysis parser — strips markdown fences, finds first JSON object ──
async function runAnalysis(
  provider: ReturnType<typeof getDefaultProvider>,
  script: string,
): Promise<ScriptAnalysis | null> {
  try {
    const res = await provider.generate(buildScriptAnalysisPrompt(script), {
      task: 'analysis', maxTokens: 1500,
    });
    let text = res.text.trim();
    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    // Find the first { ... } block
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const jsonStr = text.slice(start, end + 1);
    return JSON.parse(jsonStr) as ScriptAnalysis;
  } catch (err) {
    console.error('[scripts/generate] analysis parse failed:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    const {
      mode = 'generate',
      projectId,
      params,
      analyzeAndRewrite = true,
      externalScript,
      analysis: incomingAnalysis,
    } = body;

    // ── Validate ──────────────────────────────────────────────────────────────
    if (mode === 'rewrite' && !externalScript?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Paste a script to rewrite' } as ApiResponse<null>,
        { status: 400 },
      );
    }
    if (mode === 'fix' && (!externalScript?.trim() || !incomingAnalysis)) {
      return NextResponse.json(
        { success: false, error: 'externalScript and analysis required for fix mode' } as ApiResponse<null>,
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
    let analysis: ScriptAnalysis | null = null;

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: FIX
    // ══════════════════════════════════════════════════════════════════════════
    if (mode === 'fix') {
      const fixResp = await provider.generate(
        buildScriptFixPrompt(externalScript!, incomingAnalysis as unknown as Record<string, unknown>, params),
        { task: 'script', temperature: 0.75, maxTokens: 4000 },
      );
      finalScript = fixResp.text.trim();
      // Always re-analyse after fix so scores update
      analysis = await runAnalysis(provider, finalScript);
      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);
      return NextResponse.json({
        success: true,
        data: { script: finalScript, analysis, wordCount: finalScript.split(/\s+/).length },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: REWRITE
    // ══════════════════════════════════════════════════════════════════════════
    if (mode === 'rewrite') {
      const rwResp = await provider.generate(
        buildExternalScriptRewritePrompt(externalScript!, params),
        { task: 'script', temperature: 0.8, maxTokens: 4000 },
      );
      finalScript = rwResp.text.trim();
      // Always analyse rewritten scripts
      analysis = await runAnalysis(provider, finalScript);
      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);
      return NextResponse.json({
        success: true,
        data: { script: finalScript, analysis, wordCount: finalScript.split(/\s+/).length },
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // MODE: GENERATE — original flow, untouched
    // ══════════════════════════════════════════════════════════════════════════
    const scriptResp = await provider.generate(
      buildScriptPrompt(params),
      { task: 'script', temperature: 0.8, maxTokens: 4000 },
    );
    finalScript = scriptResp.text.trim();

    // Always analyse, regardless of the analyzeAndRewrite toggle
    analysis = await runAnalysis(provider, finalScript);

    // Auto-rewrite weak areas when toggle is on
    if (analyzeAndRewrite && analysis) {
      const a = analysis as unknown as Record<string, number>;
      const weakAreas: string[] = [];
      if ((a.hookStrength         ?? 10) < 7) weakAreas.push('Hook is weak — needs a more compelling opening line');
      if ((a.curiosity            ?? 10) < 7) weakAreas.push('Lacks curiosity gaps and open loops');
      if ((a.pacing               ?? 10) < 7) weakAreas.push('Pacing is flat — vary sentence lengths more');
      if ((a.predictability       ??  0) > 4) weakAreas.push('Too predictable — add a surprising counterintuitive fact');
      if ((a.ttsReadability       ?? 10) < 7) weakAreas.push('Hard to read aloud — simplify sentence structure');
      if ((a.narrativeProgression ?? 10) < 7) weakAreas.push('Weak narrative arc — escalate stakes earlier');

      if (weakAreas.length > 0) {
        console.log(`[scripts/generate] rewriting — ${weakAreas.length} weak areas`);
        const rwResp = await provider.generate(
          buildScriptRewritePrompt(finalScript, analysis as unknown as Record<string, unknown>, weakAreas, params),
          { task: 'script', temperature: 0.75, maxTokens: 4000 },
        );
        finalScript = rwResp.text.trim();
        // Re-analyse rewritten version
        const reanalysis = await runAnalysis(provider, finalScript);
        if (reanalysis) analysis = reanalysis;
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
