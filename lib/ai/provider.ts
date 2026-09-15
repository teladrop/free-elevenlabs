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
// Docs: https://console.groq.com/docs/models
// Model names are discovered at runtime to avoid hardcoded deprecations.

const GROQ_BASE = 'https://api.groq.com/openai/v1';

// Preferred model IDs in priority order — first one available on the account wins
const GROQ_PREFERRED = [
  'llama-3.3-70b-versatile',
  'llama-3.1-70b-versatile',
  'llama3-70b-8192',
  'llama-3.1-8b-instant',
  'llama3-8b-8192',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
  'gemma-7b-it',
];

// Audio/non-chat models to exclude
const GROQ_EXCLUDE = new Set(['whisper-large-v3', 'whisper-large-v3-turbo', 'distil-whisper-large-v3-en']);

// Cached resolved model (set on first successful call)
let _groqModel: string | null = null;

async function resolveGroqModel(apiKey: string): Promise<string> {
  if (_groqModel) return _groqModel;
  try {
    const res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json() as { data?: { id: string }[] };
      const available = new Set(
        (data.data ?? [])
          .map(m => m.id)
          .filter(id => !GROQ_EXCLUDE.has(id) && !id.includes('whisper') && !id.includes('guard')),
      );
      for (const m of GROQ_PREFERRED) {
        if (available.has(m)) {
          _groqModel = m;
          console.log(`[ai/groq] Using model: ${m}`);
          return m;
        }
      }
      // Fall back to first available chat model (exclude audio/guard models)
      const first = data.data?.find(m => !GROQ_EXCLUDE.has(m.id) && !m.id.includes('whisper') && !m.id.includes('guard'))?.id;
      if (first) { _groqModel = first; return first; }
    }
  } catch {}
  // Hard fallback if models list fails
  return 'llama-3.1-8b-instant';
}

// Per-task model mapping — overrideable via env vars
function groqModelForTask(task: AITaskType, resolved: string): string {
  // Use env-var overrides if set, otherwise use the resolved model
  const overrides: Partial<Record<AITaskType, string | undefined>> = {
    script:   process.env.GROQ_SCRIPT_MODEL,
    analysis: process.env.GROQ_ANALYSIS_MODEL,
    titles:   process.env.GROQ_TITLES_MODEL,
    visual:   process.env.GROQ_VISUAL_MODEL,
    ideas:    process.env.GROQ_IDEAS_MODEL,
  };
  return overrides[task] || resolved;
}

async function groqGenerate(
  prompt: string,
  options: GenerateOptions,
  apiKey: string,
): Promise<AIProviderResponse> {
  const { temperature = 0.7, maxTokens = 2500, task = 'script', systemPrompt } = options;
  const resolved = await resolveGroqModel(apiKey);
  const model    = groqModelForTask(task, resolved);

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
    // Model decommissioned — clear cache so next call picks a new one
    if (res.status === 400 && msg.includes('decommissioned')) {
      _groqModel = null;
    }
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
// Docs: https://ai.google.dev/gemini-api/docs/models/gemini
// Model names are discovered at runtime to avoid hardcoded deprecations.

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Preferred Gemini model IDs in priority order
// gemini-3.6-flash is the current recommended replacement per deprecation messages
const GEMINI_PREFERRED = [
  'gemini-3.6-flash',        // Current recommended (per deprecation notice)
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

// Cached resolved model
let _geminiModel: string | null = null;

async function resolveGeminiModel(apiKey: string): Promise<string> {
  if (_geminiModel) return _geminiModel;

  // Try each preferred model with a lightweight trial call
  for (const m of GEMINI_PREFERRED) {
    try {
      const res = await fetch(
        `${GEMINI_BASE}/models/${m}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
          signal: AbortSignal.timeout(8000),
        },
      );
      if (res.ok) {
        _geminiModel = m;
        console.log(`[ai/gemini] Using model: ${m}`);
        return m;
      }
      // 404 or 400 = model not available for this key, try next
      if (res.status === 404 || res.status === 400) continue;
      // Other errors (429, 500) — model exists but has a problem, still use it
      _geminiModel = m;
      console.log(`[ai/gemini] Using model (non-fatal probe error): ${m}`);
      return m;
    } catch {
      continue;
    }
  }
  // All probes failed — use last resort
  console.warn('[ai/gemini] All model probes failed, using gemini-1.5-flash as last resort');
  _geminiModel = 'gemini-1.5-flash';
  return _geminiModel;
}

async function geminiGenerate(
  prompt: string,
  options: GenerateOptions,
  apiKey: string,
): Promise<AIProviderResponse> {
  const { temperature = 0.7, maxTokens = 2500, task = 'script', systemPrompt } = options;
  const model = await resolveGeminiModel(apiKey);

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
    // Model deprecated/unavailable — clear cache so next call picks a new one
    if (res.status === 404) {
      _geminiModel = null;
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
    if (this.groqKey)   return _groqModel   || GROQ_PREFERRED[0];
    if (this.geminiKey) return _geminiModel  || GEMINI_PREFERRED[0];
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
