/**
 * AI Provider — Gemini, Groq, and OpenRouter with automatic fallback.
 *
 * Priority order (each tried in sequence until one succeeds):
 *   1. Groq        — 30 RPM / 14,400 RPD free, ultra-fast inference
 *   2. Gemini      — 15 RPM / 1,500 RPD free, Google's own models
 *   3. OpenRouter  — lowest priority, kept as last-resort fallback
 *
 * Set AI_PROVIDER=groq|gemini|openrouter to force a single provider.
 * Leave unset to use the auto-fallback chain.
 *
 * Free tier limits (as of 2024):
 *   Groq:       https://console.groq.com  → 30 req/min, 14 400 req/day
 *   Gemini:     https://aistudio.google.com → 15 req/min, 1 500 req/day
 *   OpenRouter: https://openrouter.ai/keys → varies by model (:free tier)
 */

import { AIProviderConfig, AIProviderResponse, AITaskType } from '@/lib/types';

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  task?: AITaskType;
  systemPrompt?: string;
}

/* ─── Groq Provider ──────────────────────────────────────────────────────── */
// Models: llama-3.3-70b-versatile, llama3-70b-8192, mixtral-8x7b-32768, gemma2-9b-it
// Docs: https://console.groq.com/docs/models

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// Best Groq free model per task — verified working free models
const GROQ_MODELS: Record<AITaskType, string> = {
  script:   'llama3-70b-8192',    // 70B, 8192 ctx, reliable free model
  analysis: 'llama3-70b-8192',    // Same — best for reasoning on free tier
  titles:   'llama3-8b-8192',     // Faster 8B for creative short tasks
  visual:   'llama3-70b-8192',    // Best quality for detailed descriptions
  ideas:    'llama3-8b-8192',     // Fast enough for brainstorming
};

async function groqGenerate(
  prompt: string,
  options: GenerateOptions,
  apiKey: string,
): Promise<AIProviderResponse> {
  const { temperature = 0.7, maxTokens = 2500, task = 'script', systemPrompt } = options;
  const model = GROQ_MODELS[task] || 'llama3-70b-8192';

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${GROQ_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = err.error?.message || res.statusText;
    if (res.status === 429) throw new Error(`Groq rate limit: ${msg}`);
    throw new Error(`Groq error (${res.status}): ${msg}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  return {
    text,
    model,
    usage: {
      promptTokens:     data.usage?.prompt_tokens     || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens:      data.usage?.total_tokens      || 0,
    },
  };
}

async function groqValidate(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch { return false; }
}

/* ─── Gemini Provider ────────────────────────────────────────────────────── */
// Models: gemini-2.0-flash, gemini-1.5-flash, gemini-1.5-flash-8b
// Docs: https://ai.google.dev/gemini-api/docs/models/gemini

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Best Gemini free model per task — use gemini-3.6-flash (2.0-flash is deprecated)
const GEMINI_MODELS: Record<AITaskType, string> = {
  script:   'gemini-2.5-flash',   // Best free quality, fast
  analysis: 'gemini-2.5-flash',   // Reasoning tasks
  titles:   'gemini-2.5-flash',   // Creative + fast
  visual:   'gemini-2.5-flash',   // Detailed visual descriptions
  ideas:    'gemini-2.5-flash',   // Creative ideation
};

async function geminiGenerate(
  prompt: string,
  options: GenerateOptions,
  apiKey: string,
): Promise<AIProviderResponse> {
  const { temperature = 0.7, maxTokens = 2500, task = 'script', systemPrompt } = options;
  const model = GEMINI_MODELS[task] || 'gemini-2.5-flash';

  const contents: { role: string; parts: { text: string }[] }[] = [];
  if (systemPrompt) {
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood.' }] });
  }
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  const res = await fetch(
    `${GEMINI_BASE}/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string; status?: string } };
    const msg = err.error?.message || res.statusText;
    if (res.status === 429 || err.error?.status === 'RESOURCE_EXHAUSTED') {
      throw new Error(`Gemini rate limit: ${msg}`);
    }
    throw new Error(`Gemini error (${res.status}): ${msg}`);
  }

  const data = await res.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };

  let text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
  // Strip <think> tags from reasoning models
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  return {
    text,
    model,
    usage: {
      promptTokens:     data.usageMetadata?.promptTokenCount     || 0,
      completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
      totalTokens:      data.usageMetadata?.totalTokenCount      || 0,
    },
  };
}

async function geminiValidate(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${GEMINI_BASE}/models?key=${apiKey}`, {
      signal: AbortSignal.timeout(6000),
    });
    return res.ok;
  } catch { return false; }
}

/* ─── OpenRouter Provider (fallback) ─────────────────────────────────────── */

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

async function openrouterGenerate(
  prompt: string,
  options: GenerateOptions,
  config: AIProviderConfig,
): Promise<AIProviderResponse> {
  const { temperature = 0.7, maxTokens = 2500, topP = 0.9, task = 'script', systemPrompt } = options;
  const apiKey = config.apiKey || '';

  const modelMap: Record<AITaskType, string> = {
    script:   process.env.SCRIPT_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
    analysis: process.env.ANALYSIS_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    titles:   process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
    visual:   process.env.VISUAL_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
    ideas:    process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
  };
  const model = modelMap[task] || (process.env.FALLBACK_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free');

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  const res = await fetch(`${config.baseUrl || OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': config.siteUrl || 'http://localhost:3000',
      'X-Title': config.siteName || 'ContentStudio',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens, top_p: topP }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = err.error?.message || res.statusText;
    if (res.status === 429) throw new Error(`OpenRouter rate limit: ${msg}`);
    if (res.status === 402) throw new Error(`OpenRouter model no longer free: ${msg}`);
    throw new Error(`OpenRouter error (${res.status}): ${msg}`);
  }

  const data = await res.json() as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  let text = data.choices?.[0]?.message?.content?.trim() || '';
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  return {
    text,
    model,
    usage: {
      promptTokens:     data.usage?.prompt_tokens     || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens:      data.usage?.total_tokens      || 0,
    },
  };
}

/* ─── Multi-Provider with Auto-Fallback ──────────────────────────────────── */

export class AIProvider {
  private groqKey:     string;
  private geminiKey:   string;
  private orConfig:    AIProviderConfig;
  private forced:      string | null; // 'groq' | 'gemini' | 'openrouter' | null

  constructor() {
    this.groqKey   = process.env.GROQ_API_KEY   || '';
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    this.orConfig  = {
      type:     'openrouter',
      apiKey:   process.env.OPENROUTER_API_KEY,
      baseUrl:  process.env.OPENROUTER_BASE_URL  || OPENROUTER_BASE,
      siteName: process.env.OPENROUTER_SITE_NAME || 'ContentStudio',
      siteUrl:  process.env.OPENROUTER_SITE_URL  || 'http://localhost:3000',
      models:   { script: '', analysis: '', titles: '', visual: '', ideas: '', fallback: '' },
    };
    this.forced = process.env.AI_PROVIDER || null;
  }

  /**
   * Generate text using the best available provider.
   * Falls back automatically: Groq → Gemini → OpenRouter
   */
  async generate(prompt: string, options: GenerateOptions = {}): Promise<AIProviderResponse> {
    // Forced provider — no fallback
    if (this.forced === 'groq') {
      if (!this.groqKey) throw new Error('GROQ_API_KEY is not set in .env.local');
      return groqGenerate(prompt, options, this.groqKey);
    }
    if (this.forced === 'gemini') {
      if (!this.geminiKey) throw new Error('GEMINI_API_KEY is not set in .env.local');
      return geminiGenerate(prompt, options, this.geminiKey);
    }
    if (this.forced === 'openrouter') {
      if (!this.orConfig.apiKey) throw new Error('OPENROUTER_API_KEY is not set in .env.local');
      return openrouterGenerate(prompt, options, this.orConfig);
    }

    // Auto-fallback chain
    const errors: string[] = [];

    // 1. Try Groq first (fastest + highest free limits)
    if (this.groqKey) {
      try {
        const result = await groqGenerate(prompt, options, this.groqKey);
        console.log(`[ai/provider] Used Groq (${result.model})`);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[ai/provider] Groq failed: ${msg} — trying Gemini...`);
        errors.push(`Groq: ${msg}`);
      }
    }

    // 2. Try Gemini
    if (this.geminiKey) {
      try {
        const result = await geminiGenerate(prompt, options, this.geminiKey);
        console.log(`[ai/provider] Used Gemini (${result.model})`);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[ai/provider] Gemini failed: ${msg} — trying OpenRouter...`);
        errors.push(`Gemini: ${msg}`);
      }
    }

    // 3. Try OpenRouter as last resort
    if (this.orConfig.apiKey) {
      try {
        const result = await openrouterGenerate(prompt, options, this.orConfig);
        console.log(`[ai/provider] Used OpenRouter (${result.model})`);
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`OpenRouter: ${msg}`);
      }
    }

    // All providers failed
    if (errors.length === 0) {
      throw new Error(
        'No AI provider configured. Add at least one of: GROQ_API_KEY, GEMINI_API_KEY, or OPENROUTER_API_KEY to .env.local',
      );
    }
    throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
  }

  /** Returns which providers are configured */
  getConfiguredProviders(): { groq: boolean; gemini: boolean; openrouter: boolean } {
    return {
      groq:       !!this.groqKey,
      gemini:     !!this.geminiKey,
      openrouter: !!this.orConfig.apiKey,
    };
  }

  /** Validate all configured providers */
  async validateConnection(): Promise<boolean> {
    const { groq, gemini, openrouter } = this.getConfiguredProviders();
    if (groq)       { const ok = await groqValidate(this.groqKey);           if (ok) return true; }
    if (gemini)     { const ok = await geminiValidate(this.geminiKey);        if (ok) return true; }
    if (openrouter) {
      try {
        const res = await fetch(`${this.orConfig.baseUrl || OPENROUTER_BASE}/models`, {
          headers: { Authorization: `Bearer ${this.orConfig.apiKey}` },
          signal: AbortSignal.timeout(6000),
        });
        if (res.ok) return true;
      } catch {}
    }
    return false;
  }

  /** List available free OpenRouter models (kept for Settings UI) */
  async listFreeModels(): Promise<{ id: string; name: string; contextLength: number }[]> {
    if (!this.orConfig.apiKey) return [];
    try {
      const res = await fetch(`${this.orConfig.baseUrl || OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${this.orConfig.apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = await res.json() as { data?: { id: string; name?: string; pricing?: { prompt?: string }; context_length?: number }[] };
      return (data.data || [])
        .filter(m => m.id.endsWith(':free') || parseFloat(m.pricing?.prompt || '1') === 0)
        .map(m => ({ id: m.id, name: m.name || m.id, contextLength: m.context_length || 0 }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch { return []; }
  }

  // Keep these for backwards compat with any code that uses OpenRouterProvider directly
  getModelForTask(task: AITaskType): string {
    if (this.groqKey)   return GROQ_MODELS[task]   || 'llama3-70b-8192';
    if (this.geminiKey) return GEMINI_MODELS[task]  || 'gemini-2.5-flash';
    return process.env.VISUAL_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free';
  }
}

// Keep the old class name as an alias so nothing breaks
export { AIProvider as OpenRouterProvider };

/* ─── Factory ─────────────────────────────────────────────────────────────── */

let _provider: AIProvider | null = null;

/** Returns a singleton provider instance */
export function getDefaultProvider(): AIProvider {
  if (!_provider) _provider = new AIProvider();
  return _provider;
}
