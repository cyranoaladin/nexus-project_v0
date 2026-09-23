/**
 * ARIA API base resolver — the ONLY thing that changes between a V1 and a
 * CORE_V2 identity from the client's point of view. Same cockpit, same
 * components; only the server surface differs.
 *
 * Pure, isomorphic, no Prisma/Core v2 import of any kind (§T of the
 * go-live architecture decision: the client knows an authority string and
 * a URL, nothing about how either surface is implemented).
 */
/** Mirrors `session.user.authority` (`types/next-auth.d.ts`) — kept local, not imported, so this file stays free of any Core v2/auth module dependency. */
export type AriaClientAuthority = 'CORE_V2' | 'V1';

export function resolveAriaApiBase(authority: AriaClientAuthority | undefined): string {
  return authority === 'CORE_V2' ? '/api/v2/aria' : '/api/aria';
}
