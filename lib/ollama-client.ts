/**
 * Ollama Client — Connects to the local Ollama instance for LLM inference.
 * Server: infra-ollama-1 on infra_rag_net (port 11434)
 * Models available: qwen2.5:32b, llama3.2:latest, nomic-embed-text:latest
 */

interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaChatOptions {
  /** Model name (default: qwen2.5:32b) */
  model?: string;
  /** Chat messages */
  messages: OllamaChatMessage[];
  /** Temperature (default: 0.5) */
  temperature?: number;
  /** Max tokens to generate */
  numPredict?: number;
  /** Response format: 'json' for JSON mode */
  format?: 'json' | '';
  /** Request timeout in ms (default: 120000 for 32B model) */
  timeout?: number;
}

/**
 * Get the Ollama base URL.
 * Priority: env var > Docker service name > localhost fallback
 */
function getOllamaUrl(): string {
  if (process.env.OLLAMA_URL) {
    return process.env.OLLAMA_URL;
  }
  // Inside Docker on infra_rag_net, Ollama is reachable via service name
  if (process.env.NODE_ENV === 'production') {
    return 'http://ollama:11434';
  }
  // Local dev fallback
  return 'http://localhost:11434';
}

/**
 * Send a chat completion request to Ollama.
 */
export async function ollamaChat(options: OllamaChatOptions): Promise<string> {
  const baseUrl = getOllamaUrl();
  const model = options.model || process.env.OLLAMA_MODEL || 'qwen2.5:32b';
  const timeout = options.timeout || parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: options.messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.5,
          num_predict: options.numPredict ?? 4096,
        },
        ...(options.format === 'json' ? { format: 'json' } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama chat failed: ${response.status} — ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    return data.message?.content || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama chat timeout after ${timeout}ms (model: ${model})`);
    }
    throw error;
  }
}

/**
 * Send a simple generate request to Ollama (non-chat).
 */
export async function ollamaGenerate(
  prompt: string,
  model?: string,
  format?: 'json' | ''
): Promise<string> {
  const baseUrl = getOllamaUrl();
  const selectedModel = model || process.env.OLLAMA_MODEL || 'qwen2.5:32b';
  const timeout = parseInt(process.env.OLLAMA_TIMEOUT || '120000', 10);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel,
        prompt,
        stream: false,
        ...(format === 'json' ? { format: 'json' } : {}),
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama generate failed: ${response.status} — ${errorText}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response || '';
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Ollama generate timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Check if Ollama is healthy and list available models.
 */
export async function ollamaHealthCheck(): Promise<{
  healthy: boolean;
  models: string[];
}> {
  const baseUrl = getOllamaUrl();
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { method: 'GET' });
    if (!response.ok) return { healthy: false, models: [] };
    const data = (await response.json()) as {
      models: Array<{ name: string }>;
    };
    return {
      healthy: true,
      models: data.models.map((m) => m.name),
    };
  } catch {
    return { healthy: false, models: [] };
  }
}
