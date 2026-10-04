export type PublicLinkTarget =
  | { readonly kind: 'INTERNAL'; readonly url: string }
  | { readonly kind: 'SKIP' | 'EXTERNAL' | 'UNSAFE' };

/** Classification used by the public link checker before any HTTP request. */
export function resolvePublicLinkTarget(href: string, pageUrl: string): PublicLinkTarget {
  if (!href.trim() || href.trim().startsWith('#')) return { kind: 'SKIP' };
  let target: URL;
  let base: URL;
  try {
    base = new URL(pageUrl);
    target = new URL(href, base);
  } catch {
    return { kind: 'UNSAFE' };
  }
  if (target.protocol === 'mailto:' || target.protocol === 'tel:') return { kind: 'SKIP' };
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return { kind: 'UNSAFE' };
  if (target.origin !== base.origin) return { kind: 'EXTERNAL' };
  if (target.username || target.password) return { kind: 'UNSAFE' };
  return { kind: 'INTERNAL', url: target.toString() };
}
