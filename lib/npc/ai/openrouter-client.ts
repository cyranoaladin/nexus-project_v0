// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - OpenRouter API Client
// HTTP client for NPC vision (OCR) and JSON chat completions, via OpenRouter.
// Chutes is retired: every request carries provider.ignore=["chutes"].
// ═══════════════════════════════════════════════════════════════════════════════

import {
  assertNotExcludedEndpoint,
  withExcludedProviders,
} from '../../llm/provider-exclusion';
import {
  NPC_OPENROUTER_API_KEY,
  NPC_OPENROUTER_BASE_URL,
  NPC_OPENROUTER_MODEL,
} from '../config';

/** Per-call ceiling; the worker retries at job level (NPC_MAX_RETRY_ATTEMPTS). */
const REQUEST_TIMEOUT_MS = 120_000;

/**
 * Proven transport shape of the pinned NPC model (GPT-5-family reasoning model
 * on OpenRouter): output budget via max_completion_tokens, and no
 * temperature. Same contract as ARIA's transport policy for this exact
 * identity; NPC keeps its own copy so it does not import ARIA internals.
 */
const NPC_MODEL_TRANSPORT = Object.freeze({
  outputTokenParameter: 'max_completion_tokens' as const,
  temperatureSupported: false,
});

// ─── Types ───

interface NpcMessage {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
}

interface NpcCompletionRequest {
  messages: NpcMessage[];
  /** Output budget (sent as max_completion_tokens for the pinned model). */
  max_tokens?: number;
}

interface OpenRouterCompletionResponse {
  id: string;
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Only present when usage accounting was requested (canary mode). */
    cost?: number;
  };
}

export interface NpcLlmError {
  error: string;
  status: number;
}

// ─── Client ───

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl: string;
  private fetchImpl: typeof fetch;
  private includeUsageCost: boolean;

  constructor(
    dependencies: {
      fetchImpl?: typeof fetch;
      apiKey?: string;
      baseUrl?: string;
      /** Ask OpenRouter to report the cost of each generation (off in production). */
      includeUsageCost?: boolean;
    } = {}
  ) {
    this.includeUsageCost = dependencies.includeUsageCost === true;
    this.apiKey = dependencies.apiKey ?? NPC_OPENROUTER_API_KEY;
    this.baseUrl = dependencies.baseUrl ?? NPC_OPENROUTER_BASE_URL;
    this.fetchImpl =
      dependencies.fetchImpl ?? ((input, init) => fetch(input, init));
  }

  /** The exact JSON body sent to OpenRouter (exported through complete()). */
  private buildBody(request: NpcCompletionRequest): Record<string, unknown> {
    return {
      model: NPC_OPENROUTER_MODEL,
      messages: request.messages,
      [NPC_MODEL_TRANSPORT.outputTokenParameter]: request.max_tokens ?? 8000,
      provider: withExcludedProviders(),
      ...(this.includeUsageCost ? { usage: { include: true } } : {}),
    };
  }

  async complete(request: NpcCompletionRequest): Promise<
    | {
        success: true;
        content: string;
        tokens: { prompt: number; completion: number; total: number };
        model: string;
        requestId: string | null;
        /** Cost reported by OpenRouter, or null when not reported. */
        costUsd: number | null;
      }
    | {
        success: false;
        error: string;
        status: number;
      }
  > {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'OPENROUTER_API_KEY not configured',
          status: 500,
        };
      }
      assertNotExcludedEndpoint(this.baseUrl);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let response: Response;
      try {
        response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(this.buildBody(request)),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Status only: the provider body can echo request content.
        return {
          success: false,
          error: `HTTP ${response.status}`,
          status: response.status,
        };
      }

      const data = (await response.json()) as OpenRouterCompletionResponse;

      if (!data.choices?.[0]?.message?.content) {
        return {
          success: false,
          error: 'Invalid response format from OpenRouter',
          status: 500,
        };
      }

      return {
        success: true,
        content: data.choices[0].message.content,
        tokens: {
          prompt: data.usage?.prompt_tokens || 0,
          completion: data.usage?.completion_tokens || 0,
          total: data.usage?.total_tokens || 0,
        },
        model: NPC_OPENROUTER_MODEL,
        requestId: data.id ?? null,
        costUsd: typeof data.usage?.cost === 'number' ? data.usage.cost : null,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
      };
    }
  }

  /**
   * Vision OCR - Extract text from image
   */
  async visionOcr(
    imageBase64: string,
    mimeType: string = 'image/png'
  ): Promise<
    | {
        success: true;
        text: string;
        confidence: number;
        tokens: { prompt: number; completion: number; total: number };
        requestId: string | null;
        costUsd: number | null;
      }
    | {
        success: false;
        error: string;
      }
  > {
    const result = await this.complete({
      messages: [
        {
          role: 'system',
          content:
            'Tu es un système OCR. Extrais tout le texte visible de cette image. Réponds UNIQUEMENT avec le texte extrait, sans commentaire. Si tu ne vois pas de texte lisible, réponds "NO_TEXT_DETECTED".',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extrais tout le texte visible.',
            },
          ],
        },
      ],
      max_tokens: 4000,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const text = result.content.trim();
    const confidence =
      text === 'NO_TEXT_DETECTED' ? 0 : this.estimateConfidence(text);

    return {
      success: true,
      text: text === 'NO_TEXT_DETECTED' ? '' : text,
      confidence,
      tokens: result.tokens,
      requestId: result.requestId,
      costUsd: result.costUsd,
    };
  }

  /**
   * Structured JSON completion with schema validation hint
   */
  async completeJson<T>(
    messages: NpcMessage[],
    schemaDescription: string,
    options: {
      max_tokens?: number;
    } = {}
  ): Promise<
    | {
        success: true;
        data: T;
        tokens: { prompt: number; completion: number; total: number };
        requestId: string | null;
        costUsd: number | null;
      }
    | {
        success: false;
        error: string;
        rawContent?: string;
      }
  > {
    const result = await this.complete({
      messages: [
        {
          role: 'system',
          content: `Tu dois répondre en JSON valide uniquement. Structure attendue:\n${schemaDescription}\n\nRègles:\n- Réponds UNIQUEMENT avec l'objet JSON, sans balises markdown\n- Pas de texte avant ou après le JSON\n- Assure-toi que la réponse est du JSON syntaxiquement valide`,
        },
        ...messages,
      ],
      max_tokens: options.max_tokens || 8000,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Try to parse JSON
    try {
      const cleaned = this.cleanJsonResponse(result.content);
      const data = JSON.parse(cleaned) as T;
      return {
        success: true,
        data,
        tokens: result.tokens,
        requestId: result.requestId,
        costUsd: result.costUsd,
      };
    } catch (parseError) {
      return {
        success: false,
        error: `JSON parse error: ${parseError instanceof Error ? parseError.message : 'Unknown'}`,
        rawContent: result.content,
      };
    }
  }

  // ─── Helpers ───

  private estimateConfidence(text: string): number {
    // Simple heuristic: longer text with fewer unusual characters = higher confidence
    if (!text || text.length < 10) return 0.5;

    const unusualChars = (text.match(/[^\w\s\p{P}]/gu) || []).length;
    const ratio = unusualChars / text.length;

    if (ratio > 0.1) return 0.6;
    if (ratio > 0.05) return 0.75;
    if (text.length > 100) return 0.95;
    return 0.85;
  }

  private cleanJsonResponse(content: string): string {
    // Remove markdown code blocks if present
    let cleaned = content.trim();

    // Remove ```json and ```
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');

    // Remove ``` if still present
    cleaned = cleaned.replace(/^```\s*/, '');
    cleaned = cleaned.replace(/```\s*$/, '');

    return cleaned.trim();
  }
}

// Singleton instance
export const openRouterClient = new OpenRouterClient();
