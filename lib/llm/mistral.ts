export class MistralConfigurationError extends Error {
  code = 'MISTRAL_API_KEY_MISSING';

  constructor() {
    super('MISTRAL_API_KEY is missing');
    this.name = 'MistralConfigurationError';
  }
}

export class MistralGenerationError extends Error {
  code = 'MISTRAL_GENERATION_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'MistralGenerationError';
  }
}

export type MistralChatMessage = {
  role: 'system' | 'user';
  content: string;
};

export type MistralJsonCompletion = {
  json: unknown;
  model: string;
};

export async function createMistralJsonCompletion(
  messages: MistralChatMessage[],
  options: { model?: string; temperature?: number } = {},
): Promise<MistralJsonCompletion> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new MistralConfigurationError();
  }

  const model = options.model || process.env.MISTRAL_MODEL || 'mistral-large-latest';
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new MistralGenerationError(`Mistral API returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new MistralGenerationError('Mistral API returned an empty response');
  }

  try {
    return { json: JSON.parse(content), model };
  } catch {
    throw new MistralGenerationError('Mistral API returned invalid JSON');
  }
}
