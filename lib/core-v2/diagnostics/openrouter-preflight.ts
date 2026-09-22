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

/** A true discriminated union — narrowing on `ok` also narrows `worstCaseCostUsd`/`compliantEndpoints`, no non-null assertion ever needed at the call site. */
export type OpenRouterPreflightResult =
  | Readonly<{ ok: true; compliantEndpoints: readonly CompliantEndpoint[]; worstCaseCostUsd: number }>
  | Readonly<{ ok: false; reason: string; compliantEndpoints: readonly []; worstCaseCostUsd: null }>;

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

  const worstCaseCostUsd = computeWorstCaseCostUsd(compliantEndpoints, input.estimatedPromptTokens, input.maxOutputTokens);

  return { ok: true, compliantEndpoints, worstCaseCostUsd };
}

/**
 * The conservative reservation cost: a provider NAME (e.g. "Amazon Bedrock")
 * can cover several distinct region/tag variants at DIFFERENT prices (mission
 * §4 — this is exactly what "un identifiant de fournisseur générique peut
 * couvrir plusieurs variantes" warns about: `only` below pins a provider
 * name, not a specific tag, so OpenRouter's own routing may land on ANY
 * compliant tag under it). Reserving from the cheapest tag would silently
 * under-provision if a pricier tag is the one actually used — so this takes
 * the MAXIMUM prompt rate and the MAXIMUM completion rate independently
 * across every compliant endpoint, never an average or a single row's pair.
 */
export function computeWorstCaseCostUsd(
  endpoints: readonly CompliantEndpoint[],
  promptTokens: number,
  maxOutputTokens: number,
): number {
  const maxPromptRate = Math.max(...endpoints.map((e) => e.promptUsdPerToken));
  const maxCompletionRate = Math.max(...endpoints.map((e) => e.completionUsdPerToken));
  const rawCost = promptTokens * maxPromptRate + maxOutputTokens * maxCompletionRate;
  // Round UP at the ledger's own precision (Decimal(10,6)) — a reservation
  // must never be quietly floored below what it actually reserves.
  return Math.ceil(rawCost * 1_000_000) / 1_000_000;
}

/**
 * The exact `provider` block the real completion call must send, restricted
 * to the compliant provider set the preflight found — never a looser
 * fallback. `only` lists every provider NAME still qualified (deduplicated:
 * several rows can share one provider name across region tags), so
 * OpenRouter's own routing can never silently substitute a non-ZDR or
 * non-structured-output endpoint for this call.
 */
export function buildCompliantProviderPreferences(endpoints: readonly CompliantEndpoint[]) {
  const providerNames = Array.from(new Set(endpoints.map((e) => e.providerName)));
  return {
    zdr: true,
    data_collection: 'deny' as const,
    require_parameters: true,
    allow_fallbacks: false,
    only: providerNames,
  };
}
