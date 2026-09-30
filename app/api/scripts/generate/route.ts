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

export const dynamic    = 'force-dynamic';
export const maxDuration = 180; // 3 min — fix + reanalysis can be slow

// ── Request body ──────────────────────────────────────────────────────────────
interface GenerateBody {
  mode?: 'generate' | 'rewrite' | 'fix';
  projectId?: string;
  params: ScriptGenerationParams;
  analyzeAndRewrite?: boolean;
  // rewrite / fix
  externalScript?: string;
  analysis?: ScriptAnalysis;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GenerateBody;
    const {
      mode = 'generate',
      projectId,
      params,
      analyzeAndRewrite,
      externalScript,
      analysis: incomingAnalysis,
    } = body;

    // ── Validate inputs ───────────────────────────────────────────────────────
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
    if (mode === 'generate' && !params?.topic) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: topic' } as ApiResponse<null>,
        { status: 400 },
      );
    }

    const provider = getDefaultProvider();
    const connected = await provider.validateConnection();
    if (!connected) {
      return NextResponse.json(
        { success: false, error: 'No AI provider reachable. Add GROQ_API_KEY or GEMINI_API_KEY to .env.local.' } as ApiResponse<null>,
        { status: 503 },
      );
    }

    let finalScript = '';
    let analysis: ScriptAnalysis | null = null;

    // ── Mode: FIX — apply analysis suggestions to existing script ─────────────
    if (mode === 'fix') {
      const fixPrompt = buildScriptFixPrompt(
        externalScript!,
        incomingAnalysis as unknown as Record<string, unknown>,
        params,
      );
      const fixResponse = await provider.generate(fixPrompt, {
        task: 'script',
        temperature: 0.75,
        maxTokens: 4000,
      });
      finalScript = fixResponse.text.trim();

      // Re-analyse the fixed script so scores update
      try {
        const reanalysisResponse = await provider.generate(
          buildScriptAnalysisPrompt(finalScript),
          { task: 'analysis', maxTokens: 1200 },
        );
        const m = reanalysisResponse.text.match(/\{[\s\S]*\}/);
        if (m) analysis = JSON.parse(m[0]);
      } catch { /* non-fatal */ }

      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

      return NextResponse.json({
        success: true,
        data: {
          script: finalScript,
          analysis,
          wordCount: finalScript.split(/\s+/).length,
          estimatedDuration: Math.round(finalScript.split(/\s+/).length / 140),
        },
      });
    }

    // ── Mode: REWRITE — rewrite external/user-supplied script ─────────────────
    if (mode === 'rewrite') {
      const rewritePrompt = buildExternalScriptRewritePrompt(externalScript!, params);
      const rewriteResponse = await provider.generate(rewritePrompt, {
        task: 'script',
        temperature: 0.8,
        maxTokens: 4000,
      });
      finalScript = rewriteResponse.text.trim();

      // Always analyse rewritten scripts
      try {
        const analysisResponse = await provider.generate(
          buildScriptAnalysisPrompt(finalScript),
          { task: 'analysis', maxTokens: 1200 },
        );
        const m = analysisResponse.text.match(/\{[\s\S]*\}/);
        if (m) analysis = JSON.parse(m[0]);
      } catch { /* non-fatal */ }

      if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

      return NextResponse.json({
        success: true,
        data: {
          script: finalScript,
          analysis,
          wordCount: finalScript.split(/\s+/).length,
          estimatedDuration: Math.round(finalScript.split(/\s+/).length / 140),
        },
      });
    }

    // ── Mode: GENERATE — generate fresh script ────────────────────────────────
    const scriptPrompt   = buildScriptPrompt(params);
    const scriptResponse = await provider.generate(scriptPrompt, {
      task: 'script',
      temperature: 0.8,
      maxTokens: 4000,
    });
    finalScript = scriptResponse.text.trim();

    // Optional: analyse + rewrite weak areas
    if (analyzeAndRewrite) {
      try {
        const analysisResponse = await provider.generate(
          buildScriptAnalysisPrompt(finalScript),
          { task: 'analysis', maxTokens: 1200 },
        );
        const m = analysisResponse.text.match(/\{[\s\S]*\}/);
        if (m) {
          analysis = JSON.parse(m[0]);

          const a = analysis as unknown as Record<string, number>;
          const weakAreas: string[] = [];
          if (a.hookStrength            < 6) weakAreas.push('Hook is weak — needs a more compelling opening');
          if (a.curiosity               < 6) weakAreas.push('Lacks curiosity gaps and open loops');
          if (a.pacing                  < 6) weakAreas.push('Pacing is flat — vary sentence length more');
          if (a.predictability          > 5) weakAreas.push('Too predictable — add surprising elements');
          if (a.ttsReadability          < 7) weakAreas.push('Hard to read aloud — simplify sentence structure');
          if (a.narrativeProgression    < 6) weakAreas.push('Weak narrative arc — escalate earlier');

          if (weakAreas.length > 0) {
            const rw = await provider.generate(
              buildScriptRewritePrompt(finalScript, analysis as unknown as Record<string, unknown>, weakAreas),
              { task: 'script', temperature: 0.75, maxTokens: 4000 },
            );
            finalScript = rw.text.trim();

            // Re-analyse rewritten version
            const ra = await provider.generate(
              buildScriptAnalysisPrompt(finalScript),
              { task: 'analysis', maxTokens: 1200 },
            );
            const rm = ra.text.match(/\{[\s\S]*\}/);
            if (rm) analysis = JSON.parse(rm[0]);
          }
        }
      } catch (err) {
        console.error('[scripts/generate] analysis step failed:', err);
      }
    }

    if (projectId) await updateProjectScript(projectId, finalScript, (analysis as unknown) as Record<string, unknown>);

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
