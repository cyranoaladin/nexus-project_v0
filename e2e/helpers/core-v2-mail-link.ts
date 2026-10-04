export type CoreAccountLinkPath = '/auth/activate' | '/auth/reset-password';

export function extractCoreAccountMailToken(content: string, path: CoreAccountLinkPath): string | null {
  for (const match of content.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    const candidate = match[0].replaceAll('&amp;', '&');
    if (!URL.canParse(candidate)) continue;
    const url = new URL(candidate);
    if (url.username || url.password || url.hash || url.pathname !== path
      || url.searchParams.getAll('purpose').length !== 1
      || url.searchParams.get('purpose') !== 'core-v2'
      || url.searchParams.getAll('token').length !== 1) continue;
    const token = url.searchParams.get('token');
    if (!token) continue;
    const parsed = /^v1:[a-z][a-z0-9-]{0,23}:([A-Za-z0-9_-]{43})$/.exec(token);
    const entropy = parsed?.[1];
    if (entropy && Buffer.from(entropy, 'base64url').toString('base64url') === entropy) return token;
  }
  return null;
}
