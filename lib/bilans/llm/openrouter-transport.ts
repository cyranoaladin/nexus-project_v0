import lexicon from '@/data/bilans/lexique-interdit.json';

import type { BilanGenerationRequest, BilanLlmTransport } from './gateway';

const FORBIDDEN_TERMS: readonly string[] = Object.values(lexicon.categories).flat();

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MAX_TOKENS = 2_000;
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_RETRIES = 2;

const RETRYABLE_CODES = new Set([
  'OPENROUTER_TIMEOUT',
  'OPENROUTER_NETWORK_ERROR',
  'OPENROUTER_HTTP_429',
  'OPENROUTER_HTTP_500',
  'OPENROUTER_HTTP_502',
  'OPENROUTER_HTTP_503',
  'OPENROUTER_HTTP_504',
]);

export class OpenRouterTransportError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'OpenRouterTransportError';
  }
}

export type OpenRouterConfig = Readonly<{
  apiKey: string;
  model: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  referer?: string;
  appTitle?: string;
}>;

export type OpenRouterLogger = Readonly<{
  info(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}>;

type ResolvedConfig = Readonly<{
  apiKey: string;
  model: string;
  baseUrl: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  referer?: string;
  appTitle?: string;
}>;

function resolveConfig(config: OpenRouterConfig): ResolvedConfig {
  if (config.apiKey.trim() === '') throw new OpenRouterTransportError('OPENROUTER_API_KEY_MISSING');
  if (config.model.trim() === '') throw new OpenRouterTransportError('OPENROUTER_MODEL_MISSING');
  return Object.freeze({
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl ?? DEFAULT_BASE_URL,
    maxTokens: config.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: config.temperature ?? DEFAULT_TEMPERATURE,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
    referer: config.referer,
    appTitle: config.appTitle,
  });
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1] : trimmed;
}

function buildSystemMessage(request: BilanGenerationRequest): string {
  const domainIds = request.factSheet.domains.map(({ id }) => id);
  return [
    request.agent.prompt,
    '',
    '---',
    'Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, sans bloc de code.',
    'Le JSON doit respecter EXACTEMENT ce schéma : mêmes clés, mêmes types, aucune clé supplémentaire, aucune clé manquante.',
    JSON.stringify(request.agent.outputSchema),
    '',
    `Domaines de la FactSheet à couvrir (identifiants exacts, à réutiliser tels quels dans tout champ domainId) : ${JSON.stringify(domainIds)}.`,
    'Si ta réponse contient des champs "priorites" ou "pointsAppui" avec un domainId, l\'ensemble de ces domainId à travers toute ta réponse doit, collectivement avec les autres agents, couvrir chacun des domaines ci-dessus au moins une fois — ne réutilise que ces identifiants exacts, n\'en invente aucun autre.',
    'N\'écris JAMAIS de quantité dans un texte en prose ("action", "texte", "cadre", "titre", "pourquoi", "comment", "diagnosticPedagogique", "planQuatreSemaines", etc.) : ni chiffre (0-9), ni nombre écrit en toutes lettres ("dix", "cinq", "quarante-deux"...), ni durée, ni numéro d\'étape, ni pourcentage, ni score, même approximatif. Les durées ont leur propre champ numérique séparé ("dureeMin") ; ne les mentionne jamais dans un texte.',
    'Exemple à NE JAMAIS écrire : "Refaire cinq exercices sur les puissances." Exemple correct à la place : "Refaire des exercices ciblés sur les puissances." Aucun mot de quantité ("plusieurs", "quelques", "certains") n\'est un problème, seul un NOMBRE précis (chiffré ou écrit en lettres) est interdit.',
    'N\'insère jamais de balise, de placeholder, ou de texte entre crochets (ex. "[ADRESSE]", "[NOM]") : si une information te manque, formule sans elle, n\'invente pas de jeton de substitution.',
    `N'utilise JAMAIS, sous aucune forme, l'un de ces termes ou tournures interdits : ${JSON.stringify(FORBIDDEN_TERMS)}.`,
    'Le champ "verifier.ok" doit refléter honnêtement si TOUTES les consignes ci-dessus sont respectées par les autres agents ; si le moindre doute existe, réponds ok=false et détaille la violation.',
  ].join('\n');
}

function buildUserPayload(request: BilanGenerationRequest): string {
  return JSON.stringify({
    pack: request.pack,
    factSheet: request.factSheet,
    ragEvidence: request.ragEvidence,
    priorOutputs: request.priorOutputs,
    correctionFailures: request.correctionFailures ?? [],
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const defaultLogger: OpenRouterLogger = {
  info: (event) => console.info(JSON.stringify(event)),
  error: (event) => console.error(JSON.stringify(event)),
};

/**
 * BilanLlmTransport implementation calling OpenRouter's OpenAI-compatible
 * chat/completions endpoint. Narrates from the FactSheet it is given; never
 * asked to compute or return a score. Logs event metadata only — never the
 * API key, the prompt, or the model's raw content.
 */
export class OpenRouterBilanTransport implements BilanLlmTransport {
  private readonly config: ResolvedConfig;
  private readonly logger: OpenRouterLogger;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: OpenRouterConfig,
    dependencies: Readonly<{ logger?: OpenRouterLogger; fetchImpl?: typeof fetch }> = {},
  ) {
    this.config = resolveConfig(config);
    this.logger = dependencies.logger ?? defaultLogger;
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
  }

  async generate(request: BilanGenerationRequest): Promise<unknown> {
    const messages = [
      { role: 'system' as const, content: buildSystemMessage(request) },
      { role: 'user' as const, content: buildUserPayload(request) },
    ];

    let lastError: OpenRouterTransportError = new OpenRouterTransportError('OPENROUTER_UNKNOWN_ERROR');
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      try {
        return await this.attemptOnce(request, messages, attempt);
      } catch (error) {
        lastError = error instanceof OpenRouterTransportError ? error : new OpenRouterTransportError('OPENROUTER_UNKNOWN_ERROR');
        if (attempt === this.config.maxRetries || !RETRYABLE_CODES.has(lastError.code)) throw lastError;
        await sleep(2 ** attempt * 500);
      }
    }
    throw lastError;
  }

  private async attemptOnce(
    request: BilanGenerationRequest,
    messages: readonly Readonly<{ role: 'system' | 'user'; content: string }>[],
    attempt: number,
  ): Promise<unknown> {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      };
      if (this.config.referer) headers['HTTP-Referer'] = this.config.referer;
      if (this.config.appTitle) headers['X-Title'] = this.config.appTitle;

      let response: Response;
      try {
        response = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: this.config.model,
            messages,
            max_tokens: this.config.maxTokens,
            temperature: this.config.temperature,
            response_format: { type: 'json_object' },
          }),
          signal: controller.signal,
        });
      } catch (error) {
        const aborted = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
        throw new OpenRouterTransportError(aborted ? 'OPENROUTER_TIMEOUT' : 'OPENROUTER_NETWORK_ERROR');
      }

      if (!response.ok) {
        this.logger.error({
          event: 'BILAN_OPENROUTER_CALL_FAILED',
          agentId: request.agent.id,
          model: this.config.model,
          status: response.status,
          attempt,
          latencyMs: Date.now() - startedAt,
        });
        throw new OpenRouterTransportError(`OPENROUTER_HTTP_${response.status}`);
      }

      const payload = (await response.json()) as {
        choices?: readonly { message?: { content?: unknown } }[];
      };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new OpenRouterTransportError('OPENROUTER_EMPTY_CONTENT');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripCodeFence(content));
      } catch {
        throw new OpenRouterTransportError('OPENROUTER_INVALID_JSON');
      }

      this.logger.info({
        event: 'BILAN_OPENROUTER_CALL_COMPLETED',
        agentId: request.agent.id,
        model: this.config.model,
        attempt,
        latencyMs: Date.now() - startedAt,
      });
      return parsed;
    } finally {
      clearTimeout(timeout);
    }
  }
}
