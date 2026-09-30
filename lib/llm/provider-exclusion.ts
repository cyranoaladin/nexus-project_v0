/**
 * Fournisseurs que les appels OpenRouter de la plateforme ne doivent jamais
 * atteindre. Chutes a été retiré des intégrations : OpenRouter sait router
 * vers lui, donc l'exclusion doit être portée par chaque requête
 * (`provider.ignore`), en plus du réglage de compte.
 *
 * Périmètre volontairement étroit : cet utilitaire ne prépare que le bloc
 * `provider` d'une requête Chat Completions. Il ne connaît ni prompts, ni
 * modèles, ni transport métier.
 */
export const EXCLUDED_OPENROUTER_PROVIDERS: readonly string[] = Object.freeze(['chutes']);

export class ExcludedProviderError extends Error {
  readonly code = 'OPENROUTER_EXCLUDED_PROVIDER_REQUIRED';

  constructor(message: string) {
    super(message);
    this.name = 'ExcludedProviderError';
  }
}

function isExcluded(name: unknown): boolean {
  return typeof name === 'string'
    && EXCLUDED_OPENROUTER_PROVIDERS.includes(name.trim().toLowerCase());
}

/**
 * Renvoie un bloc `provider` OpenRouter dont `ignore` contient toujours les
 * fournisseurs exclus, en conservant toutes les autres contraintes reçues
 * (`only`, `zdr`, `data_collection`, `require_parameters`, ...).
 *
 * Échec explicite, jamais de retrait silencieux, si les contraintes
 * demandent explicitement un fournisseur exclu (`only` ou `order`) : aucune
 * route ne respecterait alors à la fois la contrainte et l'exclusion.
 */
export function withExcludedProviders<T extends Readonly<Record<string, unknown>>>(
  provider?: T,
): Omit<T, 'ignore'> & { readonly ignore: readonly string[] } {
  const base: Record<string, unknown> = { ...(provider ?? {}) };

  for (const key of ['only', 'order'] as const) {
    const value = base[key];
    if (Array.isArray(value) && value.some(isExcluded)) {
      throw new ExcludedProviderError(
        `provider.${key} demande un fournisseur exclu : aucune route conforme.`,
      );
    }
  }

  const existing = Array.isArray(base.ignore) ? (base.ignore as unknown[]) : [];
  const ignore: string[] = [];
  for (const name of [...existing, ...EXCLUDED_OPENROUTER_PROVIDERS]) {
    if (typeof name !== 'string') continue;
    if (!ignore.some((known) => known.toLowerCase() === name.toLowerCase())) ignore.push(name);
  }
  base.ignore = ignore;
  return Object.freeze(base) as Omit<T, 'ignore'> & { readonly ignore: readonly string[] };
}

/** Refuse un point d'accès direct vers un fournisseur exclu (base URL configurable). */
export function assertNotExcludedEndpoint(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    throw new ExcludedProviderError('URL de fournisseur invalide.');
  }
  if (EXCLUDED_OPENROUTER_PROVIDERS.some((name) => host === `${name}.ai` || host.endsWith(`.${name}.ai`))) {
    throw new ExcludedProviderError('Point d’accès direct vers un fournisseur exclu refusé.');
  }
}
