import { NextResponse } from 'next/server';
import { getDefaultProvider } from '@/lib/ai/provider';

export const dynamic = 'force-dynamic';

export async function GET() {
  const provider = getDefaultProvider();
  const apiKey   = process.env.OPENROUTER_API_KEY || '';

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      connected: false,
      error:    'OPENROUTER_API_KEY is not configured in .env.local',
      models:   [],
      configured: {
        script:   process.env.SCRIPT_MODEL   || 'qwen/qwen3-235b-a22b:free',
        analysis: process.env.ANALYSIS_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b:free',
        titles:   process.env.TITLES_MODEL   || 'qwen/qwen3-30b-a3b:free',
        visual:   process.env.VISUAL_MODEL   || 'qwen/qwen3-235b-a22b:free',
        ideas:    process.env.TITLES_MODEL   || 'qwen/qwen3-30b-a3b:free',
        fallback: process.env.FALLBACK_MODEL || 'qwen/qwen3-30b-a3b:free',
      },
    });
  }

  const [connected, freeModels] = await Promise.all([
    provider.validateConnection(),
    provider.listFreeModels(),
  ]);

  return NextResponse.json({
    success:   connected,
    connected,
    models:    freeModels,
    configured: {
      script:   process.env.SCRIPT_MODEL   || 'qwen/qwen3-235b-a22b:free',
      analysis: process.env.ANALYSIS_MODEL || 'deepseek/deepseek-r1-0528-qwen3-8b:free',
      titles:   process.env.TITLES_MODEL   || 'qwen/qwen3-30b-a3b:free',
      visual:   process.env.VISUAL_MODEL   || 'qwen/qwen3-235b-a22b:free',
      ideas:    process.env.TITLES_MODEL   || 'qwen/qwen3-30b-a3b:free',
      fallback: process.env.FALLBACK_MODEL || 'qwen/qwen3-30b-a3b:free',
    },
  });
}
