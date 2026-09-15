import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface ProviderStatus {
  configured: boolean;
  connected:  boolean;
  label:      string;
  limits?:    string;
  error?:     string;
}

async function checkGroq(apiKey: string): Promise<ProviderStatus> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as { data?: { id: string }[] };
      const models = data.data?.map(m => m.id) ?? [];
      return {
        configured: true,
        connected:  true,
        label:      'Groq',
        limits:     '30 req/min · 14,400 req/day free',
      };
    }
    return { configured: true, connected: false, label: 'Groq', error: `HTTP ${res.status}` };
  } catch (e) {
    return { configured: true, connected: false, label: 'Groq', error: e instanceof Error ? e.message : 'Failed' };
  }
}

async function checkGemini(apiKey: string): Promise<ProviderStatus> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (res.ok) {
      return {
        configured: true,
        connected:  true,
        label:      'Gemini',
        limits:     '15 req/min · 1,500 req/day free',
      };
    }
    return { configured: true, connected: false, label: 'Gemini', error: `HTTP ${res.status}` };
  } catch (e) {
    return { configured: true, connected: false, label: 'Gemini', error: e instanceof Error ? e.message : 'Failed' };
  }
}

async function checkOpenRouter(apiKey: string): Promise<ProviderStatus> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as { data?: { id: string; pricing?: { prompt: string }; context_length?: number }[] };
      const freeModels = (data.data ?? []).filter(
        m => m.id.endsWith(':free') || parseFloat(m.pricing?.prompt || '1') === 0,
      );
      return {
        configured: true,
        connected:  true,
        label:      'OpenRouter',
        limits:     `${freeModels.length} free models available (rate-limited fallback)`,
      };
    }
    return { configured: true, connected: false, label: 'OpenRouter', error: `HTTP ${res.status}` };
  } catch (e) {
    return { configured: true, connected: false, label: 'OpenRouter', error: e instanceof Error ? e.message : 'Failed' };
  }
}

export async function GET() {
  const groqKey  = process.env.GROQ_API_KEY   || '';
  const gemKey   = process.env.GEMINI_API_KEY  || '';
  const orKey    = process.env.OPENROUTER_API_KEY || '';
  const forced   = process.env.AI_PROVIDER || '';

  // Run all configured provider checks in parallel
  const [groq, gemini, openrouter] = await Promise.all([
    groqKey ? checkGroq(groqKey)           : Promise.resolve<ProviderStatus>({ configured: false, connected: false, label: 'Groq' }),
    gemKey  ? checkGemini(gemKey)          : Promise.resolve<ProviderStatus>({ configured: false, connected: false, label: 'Gemini' }),
    orKey   ? checkOpenRouter(orKey)       : Promise.resolve<ProviderStatus>({ configured: false, connected: false, label: 'OpenRouter' }),
  ]);

  const anyConnected = groq.connected || gemini.connected || openrouter.connected;

  // Active provider in priority order
  const active = forced
    ? forced
    : groq.connected    ? 'groq'
    : gemini.connected  ? 'gemini'
    : openrouter.connected ? 'openrouter'
    : 'none';

  // Model info per task
  const models = {
    groq: {
      script:   'llama-3.3-70b-versatile',
      analysis: 'llama-3.3-70b-versatile',
      titles:   'llama3-70b-8192',
      visual:   'llama-3.3-70b-versatile',
      ideas:    'llama3-70b-8192',
    },
    gemini: {
      script:   'gemini-2.0-flash',
      analysis: 'gemini-2.0-flash',
      titles:   'gemini-1.5-flash',
      visual:   'gemini-2.0-flash',
      ideas:    'gemini-1.5-flash',
    },
    openrouter: {
      script:   process.env.SCRIPT_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
      analysis: process.env.ANALYSIS_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
      titles:   process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
      visual:   process.env.VISUAL_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
      ideas:    process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
    },
  };

  return NextResponse.json({
    success:   anyConnected,
    connected: anyConnected,
    active,
    forced:    forced || null,
    providers: { groq, gemini, openrouter },
    models:    models[active as keyof typeof models] ?? models.openrouter,
  });
}
