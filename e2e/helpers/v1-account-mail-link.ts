/**
 * Liens des courriels Core v1 lus dans Mailpit sous CORE_V2_AUTH_MODE=V1_ONLY.
 *
 *   - activation : `/auth/activate?token=<pact_|sact_>…&purpose=<parent|student>`
 *     (lib/auth/parent-activation.ts buildTrustedActivationUrl, jeton issu de
 *     lib/auth/activation-token.ts createActivationToken : préfixe + 32 octets
 *     base64url = 43 caractères) ;
 *   - réinitialisation : `/auth/reset-password?token=<payload>.<hmac>` sans
 *     `purpose` (app/api/auth/reset-password/route.ts, lib/password-reset-token.ts :
 *     payload JSON base64url, signature HMAC-SHA256 base64url = 43 caractères).
 *
 * Analyse d'URL exacte (chemin, paramètres décodés, `&amp;` HTML), aucune
 * expression régulière dynamique, aucun jeton brut dans les erreurs.
 */
export type V1ActivationPurpose = 'parent' | 'student';

const ACTIVATION_PREFIX: Readonly<Record<V1ActivationPurpose, string>> = { parent: 'pact_', student: 'sact_' };

function* mailUrls(content: string): Generator<URL> {
  for (const match of content.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    const candidate = match[0].replaceAll('&amp;', '&');
    if (!URL.canParse(candidate)) continue;
    const url = new URL(candidate);
    if (url.username || url.password || url.hash) continue;
    yield url;
  }
}

function isCanonicalBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value;
}

export function extractV1ActivationToken(content: string, purpose: V1ActivationPurpose): string | null {
  const prefix = ACTIVATION_PREFIX[purpose];
  for (const url of mailUrls(content)) {
    if (url.pathname !== '/auth/activate'
      || url.searchParams.getAll('purpose').length !== 1 || url.searchParams.get('purpose') !== purpose
      || url.searchParams.getAll('token').length !== 1 || url.searchParams.has('source')) continue;
    const token = url.searchParams.get('token');
    if (!token?.startsWith(prefix)) continue;
    const entropy = token.slice(prefix.length);
    if (entropy.length === 43 && isCanonicalBase64Url(entropy)) return token;
  }
  return null;
}

export function extractV1ResetToken(content: string): string | null {
  for (const url of mailUrls(content)) {
    if (url.pathname !== '/auth/reset-password' || url.searchParams.has('purpose')
      || url.searchParams.getAll('token').length !== 1) continue;
    const token = url.searchParams.get('token');
    const parts = token?.split('.') ?? [];
    if (parts.length !== 2) continue;
    const [payload, signature] = parts as [string, string];
    if (payload.length > 0 && isCanonicalBase64Url(payload) && signature.length === 43 && isCanonicalBase64Url(signature)) return token;
  }
  return null;
}

/** Identité portée par un jeton de réinitialisation V1 (payload non secret : userId, email, exp). */
export function v1ResetTokenSubject(token: string): { userId?: unknown; email?: unknown } {
  return JSON.parse(Buffer.from(token.split('.')[0]!, 'base64url').toString('utf-8')) as { userId?: unknown; email?: unknown };
}
