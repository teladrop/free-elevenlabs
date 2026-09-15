import { NextResponse } from 'next/server';

/**
 * GET /api/youtube/test
 * Verifies YouTube API and AI provider configuration.
 */
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      youtubeApiKey:    !!process.env.YOUTUBE_API_KEY,
      groqApiKey:       !!process.env.GROQ_API_KEY,
      geminiApiKey:     !!process.env.GEMINI_API_KEY,
      openrouterApiKey: !!process.env.OPENROUTER_API_KEY,
      aiProvider:       process.env.AI_PROVIDER || 'auto-fallback',
    },
  };

  // ── YouTube API ──────────────────────────────────────────────────────────
  if (process.env.YOUTUBE_API_KEY) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`,
      );
      if (res.ok)                checks.youtubeStatus = 'Connected ✅';
      else if (res.status === 429) checks.youtubeStatus = 'Quota exceeded (resets midnight PT) ⏳';
      else {
        const e = await res.json() as { error?: { message?: string } };
        checks.youtubeStatus = `Error: ${e.error?.message || res.statusText}`;
      }
    } catch (e) {
      checks.youtubeStatus = `Connection failed: ${e instanceof Error ? e.message : e}`;
    }
  } else {
    checks.youtubeStatus = 'YouTube API key not configured ❌';
  }

  // ── Groq ─────────────────────────────────────────────────────────────────
  if (process.env.GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        signal: AbortSignal.timeout(6000),
      });
      checks.groqStatus = res.ok
        ? 'Connected ✅ (30 req/min · 14,400 req/day free)'
        : `Error: ${res.statusText}`;
    } catch (e) {
      checks.groqStatus = `Connection failed: ${e instanceof Error ? e.message : e}`;
    }
  } else {
    checks.groqStatus = 'GROQ_API_KEY not set — add at https://console.groq.com ❌';
  }

  // ── Gemini ────────────────────────────────────────────────────────────────
  if (process.env.GEMINI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
        { signal: AbortSignal.timeout(6000) },
      );
      checks.geminiStatus = res.ok
        ? 'Connected ✅ (15 req/min · 1,500 req/day free)'
        : `Error: ${res.statusText}`;
    } catch (e) {
      checks.geminiStatus = `Connection failed: ${e instanceof Error ? e.message : e}`;
    }
  } else {
    checks.geminiStatus = 'GEMINI_API_KEY not set — add at https://aistudio.google.com/apikey ❌';
  }

  // ── OpenRouter (fallback) ─────────────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        signal: AbortSignal.timeout(6000),
      });
      checks.openrouterStatus = res.ok
        ? 'Connected ✅ (fallback only — rate-limited free tier)'
        : `Error: ${res.statusText}`;
    } catch (e) {
      checks.openrouterStatus = `Connection failed: ${e instanceof Error ? e.message : e}`;
    }
  } else {
    checks.openrouterStatus = 'OPENROUTER_API_KEY not set (optional fallback) ⚠️';
  }

  return NextResponse.json(checks);
}
