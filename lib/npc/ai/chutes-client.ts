// ═══════════════════════════════════════════════════════════════════════════════
// NPC AI - Chutes.ai API Client
// HTTP client for Chutes.ai vision and chat completions
// ═══════════════════════════════════════════════════════════════════════════════

import { CHUTES_API_KEY, CHUTES_BASE_URL } from '../config';

// ─── Types ───

interface ChutesMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

interface ChutesCompletionRequest {
  model: string;
  messages: ChutesMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' } | { type: 'json_schema'; json_schema: unknown };
}

interface ChutesCompletionResponse {
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
  };
}

export interface ChutesError {
  error: string;
  status: number;
}

// ─── Client ───

export class ChutesClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = CHUTES_API_KEY || '';
    this.baseUrl = CHUTES_BASE_URL || 'https://api.chutes.ai';

    if (!this.apiKey) {
      console.warn('[Chutes] API key not configured - calls will fail');
    }
  }

  async complete(request: ChutesCompletionRequest): Promise<{
    success: true;
    content: string;
    tokens: { prompt: number; completion: number; total: number };
    model: string;
  } | {
    success: false;
    error: string;
    status: number;
  }> {
    try {
      if (!this.apiKey) {
        return {
          success: false,
          error: 'CHUTES_API_KEY not configured',
          status: 500,
        };
      }

      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
          status: response.status,
        };
      }

      const data = await response.json() as ChutesCompletionResponse;

      if (!data.choices?.[0]?.message?.content) {
        return {
          success: false,
          error: 'Invalid response format from Chutes.ai',
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
        model: request.model,
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
  async visionOcr(imageBase64: string, mimeType: string = 'image/png'): Promise<{
    success: true;
    text: string;
    confidence: number;
    tokens: { prompt: number; completion: number; total: number };
  } | {
    success: false;
    error: string;
  }> {
    const result = await this.complete({
      model: 'unsloth/Llama-3.2-11B-Vision-Instruct',
      messages: [
        {
          role: 'system',
          content: 'Tu es un système OCR. Extrais tout le texte visible de cette image. Réponds UNIQUEMENT avec le texte extrait, sans commentaire. Si tu ne vois pas de texte lisible, réponds "NO_TEXT_DETECTED".',
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
      temperature: 0.1,
      max_tokens: 4000,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const text = result.content.trim();
    const confidence = text === 'NO_TEXT_DETECTED' ? 0 : this.estimateConfidence(text);

    return {
      success: true,
      text: text === 'NO_TEXT_DETECTED' ? '' : text,
      confidence,
      tokens: result.tokens,
    };
  }

  /**
   * Structured JSON completion with schema validation hint
   */
  async completeJson<T>(
    messages: ChutesMessage[],
    schemaDescription: string,
    options: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<{
    success: true;
    data: T;
    tokens: { prompt: number; completion: number; total: number };
  } | {
    success: false;
    error: string;
    rawContent?: string;
  }> {
    const result = await this.complete({
      model: options.model || 'chutesai/Llama-4-Maverick-17B-128E-Instruct-FP8',
      messages: [
        {
          role: 'system',
          content: `Tu dois répondre en JSON valide uniquement. Structure attendue:\n${schemaDescription}\n\nRègles:\n- Réponds UNIQUEMENT avec l'objet JSON, sans balises markdown\n- Pas de texte avant ou après le JSON\n- Assure-toi que la réponse est du JSON syntaxiquement valide`,
        },
        ...messages,
      ],
      temperature: options.temperature ?? 0.2,
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
export const chutesClient = new ChutesClient();
