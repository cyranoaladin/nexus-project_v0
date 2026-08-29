/**
 * ARIA Model Provider Gateway.
 *
 * Point d'accès UNIQUE aux modèles LLM pour ARIA.
 * Gère le timeout, la cancellation (AbortSignal), les quotas de tokens et le streaming.
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'ollama',
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface StreamChatOptions {
  readonly model?: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  readonly signal?: AbortSignal;
}

export function getAriaDefaultModel(): string {
  return process.env.ARIA_MODEL || process.env.OPENAI_MODEL || 'gpt-4o';
}

/**
 * Diffuse les tokens d'un appel chat completion sous forme d'un générateur asynchrone.
 */
export async function* streamChatCompletion(
  messages: readonly ChatMessage[],
  options?: StreamChatOptions
): AsyncGenerator<string, void, unknown> {
  const client = getOpenAIClient();
  const model = options?.model || getAriaDefaultModel();
  const maxTokens = options?.maxTokens ?? 1500;
  const temperature = options?.temperature ?? 0.7;

  try {
    const stream = await client.chat.completions.create(
      {
        model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
        stream: true,
      },
      {
        signal: options?.signal,
      }
    );

    for await (const chunk of stream) {
      if (options?.signal?.aborted) {
        break;
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Annulation normale par l'utilisateur
      return;
    }
    // Sanitisation des erreurs : ne jamais exposer de clé API ou de chemin interne
    const message = error instanceof Error ? error.message : 'Erreur du fournisseur de modèle IA';
    throw new Error(`Erreur d'inférence IA : ${message.replace(/sk-[a-zA-Z0-9_-]+/g, '[REDACTED]')}`);
  }
}
