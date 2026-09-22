/**
 * Read-only preflight for the C2 AI pilot (owner decision, 2026-09-22;
 * mission §5): verifies — WITHOUT ever generating anything — that a real,
 * currently live, ZDR-certified OpenRouter endpoint for the exact pilot
 * model (anthropic/claude-sonnet-4.5) actually supports structured output
 * (response_format), and computes TODAY's worst-case per-call cost from
 * live pricing. Never trusts a cached policy file or a stored constant:
 * every check hits OpenRouter's own API at call time. Both calls used here
 * (GET /auth/key, GET /endpoints/zdr) are free, no-cost reads — this
 * function never calls /chat/completions.
 */

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/** The exact model named in the owner's authorization — never substituted. */
export const PILOT_MODEL = 'anthropic/claude-sonnet-4.5';

/**
 * Structured bilan output must be schema-validated app-side AND actually
 * declared supported by the endpoint itself — never assumed from the
 * model's name or from another provider's endpoint for the same model.
 */
const REQUIRED_PARAMETERS = ['response_format'] as const;

export interface CompliantEndpoint {
  readonly providerName: string;
  readonly tag: string;
  readonly promptUsdPerToken: number;
  readonly completionUsdPerToken: number;
}

export interface OpenRouterPreflightResult {
  readonly ok: boolean;
  /** Present only when ok is false — never throws for an ordinary "not currently available" outcome. */
  readonly reason?: string;
  readonly compliantEndpoints: readonly CompliantEndpoint[];
  readonly worstCaseCostUsd: number | null;
}

interface ZdrEndpointRow {
  readonly model_id?: string;
  readonly provider_name?: string;
  readonly tag?: string;
  readonly supported_parameters?: readonly string[];
  readonly pricing?: { readonly prompt?: string; readonly completion?: string };
}

export interface RunOpenRouterPreflightInput {
  readonly apiKey: string;
  readonly model?: string;
  /** A conservative, worst-case count of prompt tokens the actual call will send (system + copy excerpt + criteria). */
  readonly estimatedPromptTokens: number;
  readonly maxOutputTokens: number;
  readonly fetchImpl?: typeof fetch;
}

function notOk(reason: string): OpenRouterPreflightResult {
  return { ok: false, reason, compliantEndpoints: [], worstCaseCostUsd: null };
}

export async function runOpenRouterPreflight(input: RunOpenRouterPreflightInput): Promise<OpenRouterPreflightResult> {
  const model = input.model ?? PILOT_MODEL;
  const fetchImpl = input.fetchImpl ?? fetch;

  if (input.apiKey.trim() === '') return notOk('OPENROUTER_API_KEY_MISSING');
  if (!Number.isFinite(input.maxOutputTokens) || input.maxOutputTokens <= 0) return notOk('MAX_OUTPUT_TOKENS_INVALID');
  if (!Number.isFinite(input.estimatedPromptTokens) || input.estimatedPromptTokens < 0) {
    return notOk('ESTIMATED_PROMPT_TOKENS_INVALID');
  }

  let keyResponse: Response;
  try {
    keyResponse = await fetchImpl(`${OPENROUTER_BASE_URL}/auth/key`, {
      headers: { Authorization: `Bearer ${input.apiKey}` },
    });
  } catch {
    return notOk('OPENROUTER_KEY_CHECK_NETWORK_ERROR');
  }
  if (!keyResponse.ok) return notOk(`OPENROUTER_KEY_CHECK_HTTP_${keyResponse.status}`);

  let zdrResponse: Response;
  try {
    zdrResponse = await fetchImpl(`${OPENROUTER_BASE_URL}/endpoints/zdr`);
  } catch {
    return notOk('OPENROUTER_ZDR_LIST_NETWORK_ERROR');
  }
  if (!zdrResponse.ok) return notOk(`OPENROUTER_ZDR_LIST_HTTP_${zdrResponse.status}`);

  const zdrPayload = (await zdrResponse.json()) as { data?: readonly ZdrEndpointRow[] };
  const rows = zdrPayload.data ?? [];

  const compliantEndpoints: CompliantEndpoint[] = rows
    .filter((row) => row.model_id === model)
    .filter((row) => REQUIRED_PARAMETERS.every((p) => (row.supported_parameters ?? []).includes(p)))
    .filter((row) => row.pricing?.prompt !== undefined && row.pricing?.completion !== undefined)
    .map((row) => ({
      providerName: row.provider_name ?? 'unknown',
      tag: row.tag ?? 'unknown',
      promptUsdPerToken: Number(row.pricing?.prompt),
      completionUsdPerToken: Number(row.pricing?.completion),
    }))
    .filter((endpoint) => Number.isFinite(endpoint.promptUsdPerToken) && Number.isFinite(endpoint.completionUsdPerToken));

  if (compliantEndpoints.length === 0) {
    return notOk('NO_ZDR_ENDPOINT_SUPPORTS_STRUCTURED_OUTPUT_FOR_THIS_MODEL');
  }

  const cheapest = compliantEndpoints.reduce((best, endpoint) =>
    endpoint.completionUsdPerToken < best.completionUsdPerToken ? endpoint : best,
  );
  const worstCaseCostUsd =
    input.estimatedPromptTokens * cheapest.promptUsdPerToken + input.maxOutputTokens * cheapest.completionUsdPerToken;

  return { ok: true, compliantEndpoints, worstCaseCostUsd };
}

/**
 * The exact `provider` block the real completion call must send, restricted
 * to whichever compliant endpoint the preflight selected — never a looser
 * fallback. `only` pins the provider so a mid-flight OpenRouter routing
 * change can never silently substitute a non-ZDR or non-structured-output
 * endpoint for this call.
 */
export function buildCompliantProviderPreferences(endpoint: CompliantEndpoint) {
  return {
    zdr: true,
    data_collection: 'deny' as const,
    require_parameters: true,
    allow_fallbacks: false,
    only: [endpoint.providerName],
  };
}
