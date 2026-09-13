/**
 * AI Provider — OpenRouter only.
 *
 * All models carry the :free suffix — verified prompt cost = $0.
 * Confirmed from live GET https://openrouter.ai/api/v1/models on 2026-09-12.
 *
 *   Script / Visual  →  nvidia/nemotron-3-ultra-550b-a55b:free  (550B, 1M ctx)
 *   Analysis         →  nex-agi/nex-n2.5-pro:free               (262K ctx, reasoning)
 *   Titles / Ideas   →  nvidia/nemotron-3-super-120b-a12b:free  (120B, 262K ctx)
 *   Fallback         →  nvidia/nemotron-3-super-120b-a12b:free
 *
 * Models are fully configurable via environment variables and the Settings UI.
 */

import { AIProviderConfig, AIProviderResponse, AITaskType } from '@/lib/types';

export interface GenerateOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  task?: AITaskType;
  /** Pass raw system prompt for reasoning models */
  systemPrompt?: string;
}

export interface ModelInfo {
  name: string;
  provider: string;
  contextWindow: number;
  isFree: boolean;
}

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

/* ─── OpenRouter Provider ─────────────────────────────────────────────────── */
export class OpenRouterProvider {
  private config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  /** Pick the right model for the task type */
  private modelForTask(task: AITaskType = 'script'): string {
    const m = this.config.models;
    switch (task) {
      case 'script':   return m.script   || m.fallback;
      case 'analysis': return m.analysis || m.fallback;
      case 'titles':   return m.titles   || m.fallback;
      case 'visual':   return m.visual   || m.fallback;
      case 'ideas':    return m.ideas    || m.fallback;
      default:         return m.fallback;
    }
  }

  async generate(prompt: string, options: GenerateOptions = {}): Promise<AIProviderResponse> {
    const { temperature = 0.7, maxTokens = 2500, topP = 0.9, task = 'script', systemPrompt } = options;
    const apiKey = this.config.apiKey;

    if (!apiKey) {
      throw new Error(
        'OpenRouter API key is missing. Add OPENROUTER_API_KEY to .env.local and restart the dev server.',
      );
    }

    const model = this.modelForTask(task);

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      top_p: topP,
    };

    try {
      const res = await fetch(`${this.config.baseUrl || OPENROUTER_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': this.config.siteUrl || 'http://localhost:3000',
          'X-Title': this.config.siteName || 'ContentStudio',
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          (errBody as { error?: { message?: string } }).error?.message ||
          res.statusText;

        // Surface a clear message for rate-limit / model-unavailable errors
        if (res.status === 429) {
          throw new Error(
            `Rate limit reached for model "${model}". Try again in a moment or switch to the fallback model in Settings.`,
          );
        }
        if (res.status === 402) {
          throw new Error(
            `The model "${model}" is no longer free on OpenRouter. Update the model in Settings.`,
          );
        }
        throw new Error(`OpenRouter error (${res.status}): ${msg}`);
      }

      const data = await res.json();

      // Some reasoning models return content inside <think> tags — strip them
      let text: string = data.choices?.[0]?.message?.content || '';
      text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      return {
        text,
        model,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
      };
    } catch (err) {
      if (err instanceof Error) throw err;
      throw new Error('OpenRouter request failed');
    }
  }

  /** Check the key is valid and OpenRouter is reachable */
  async validateConnection(): Promise<boolean> {
    const apiKey = this.config.apiKey;
    if (!apiKey) return false;
    try {
      const res = await fetch(`${this.config.baseUrl || OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(6000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /** List available free models for the Settings page */
  async listFreeModels(): Promise<{ id: string; name: string; contextLength: number }[]> {
    const apiKey = this.config.apiKey;
    if (!apiKey) return [];
    try {
      const res = await fetch(`${this.config.baseUrl || OPENROUTER_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || [])
        .filter((m: { id: string; pricing?: { prompt: string } }) =>
          m.id.endsWith(':free') || parseFloat(m.pricing?.prompt || '1') === 0,
        )
        .map((m: { id: string; name: string; context_length?: number }) => ({
          id: m.id,
          name: m.name || m.id,
          contextLength: m.context_length || 0,
        }))
        .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));
    } catch {
      return [];
    }
  }

  getModelForTask(task: AITaskType): string {
    return this.modelForTask(task);
  }
}

/* ─── Factory ─────────────────────────────────────────────────────────────── */

/** Reads all config from environment variables */
export function getDefaultProvider(): OpenRouterProvider {
  const config: AIProviderConfig = {
    type: 'openrouter',
    apiKey:   process.env.OPENROUTER_API_KEY,
    baseUrl:  process.env.OPENROUTER_BASE_URL || OPENROUTER_BASE,
    siteName: process.env.OPENROUTER_SITE_NAME || 'ContentStudio',
    siteUrl:  process.env.OPENROUTER_SITE_URL  || 'http://localhost:3000',
    models: {
      script:   process.env.SCRIPT_MODEL   || 'nvidia/nemotron-3-ultra-550b-a55b:free',
      analysis: process.env.ANALYSIS_MODEL || 'nex-agi/nex-n2.5-pro:free',
      titles:   process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
      visual:   process.env.VISUAL_MODEL   || 'nvidia/nemotron-3-ultra-550b-a55b:free',
      ideas:    process.env.TITLES_MODEL   || 'nvidia/nemotron-3-super-120b-a12b:free',
      fallback: process.env.FALLBACK_MODEL || 'nvidia/nemotron-3-super-120b-a12b:free',
    },
  };

  return new OpenRouterProvider(config);
}
