/**
 * Transport-level guard for the canary. Every request of the run, from the NPC
 * client and from the ARIA SDK path alike, goes through this `fetch`:
 *  - only https://openrouter.ai/api/v1/ is reachable (no Chutes, no other gateway);
 *  - a generation request must name the pinned model, carry provider.ignore
 *    with "chutes", and must not ask for model/route fallbacks;
 *  - at most `maxGenerations` generation requests are ever forwarded.
 * A refused request throws before any network I/O and is not counted as emitted.
 * Catalogue GETs are counted separately: they are not generations.
 */
export const OPENROUTER_API_PREFIX = 'https://openrouter.ai/api/v1/';
export const OPENROUTER_CHAT_URL = `${OPENROUTER_API_PREFIX}chat/completions`;

export interface GenerationGuard {
  readonly fetch: typeof fetch;
  generationCount(): number;
  catalogCount(): number;
}

export function createGenerationGuard(
  inner: typeof fetch,
  options: { readonly model: string; readonly maxGenerations: number },
): GenerationGuard {
  let generations = 0;
  let catalogs = 0;

  const guarded = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    if (!url.startsWith(OPENROUTER_API_PREFIX)) throw new Error('CANARY_HOST_REJECTED');

    if (url === OPENROUTER_CHAT_URL && method === 'POST') {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      } catch {
        throw new Error('CANARY_REQUEST_REJECTED:body');
      }
      const provider = body.provider as { ignore?: unknown } | undefined;
      const ignored = Array.isArray(provider?.ignore) ? provider.ignore.map(String) : [];
      if (body.model !== options.model) throw new Error('CANARY_REQUEST_REJECTED:model');
      if (!ignored.some((name) => name.toLowerCase() === 'chutes')) throw new Error('CANARY_REQUEST_REJECTED:exclusion');
      if ('models' in body || 'route' in body) throw new Error('CANARY_REQUEST_REJECTED:fallback');
      if (generations >= options.maxGenerations) throw new Error('CANARY_GENERATION_LIMIT');
      generations += 1;
    } else if (method === 'GET') {
      catalogs += 1;
    } else {
      throw new Error('CANARY_REQUEST_REJECTED:method');
    }
    return inner(input, init);
  }) as typeof fetch;

  return { fetch: guarded, generationCount: () => generations, catalogCount: () => catalogs };
}
