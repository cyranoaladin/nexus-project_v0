/**
 * The single source of truth for "ADMIN may reach this ASSISTANTE-prefixed
 * page too" — narrow, named exceptions to the role/prefix gate, never a
 * blanket `/dashboard/assistante/*` exception.
 *
 * This used to be duplicated: `middleware.ts` held its own copy of this
 * logic, and NextAuth's `authorized()` callback (auth.config.ts) held a
 * second, independent implementation of the *general* role/prefix gate with
 * no exceptions at all. Because `authorized()` runs inside the real
 * `auth()` wrapper before a custom middleware handler's own logic, its
 * redirect fires first — so none of these exceptions ever took effect in a
 * real request, only in tests that mock `next-auth` and call the inner
 * handler directly (measured live: ADMIN hit a 302 to `/dashboard/admin`
 * from `authorized()`, not the intended 200, for a path this module's
 * predecessor in `middleware.ts` already listed as allowed). Both call
 * sites now import this one function.
 */
export function isAdminSupervisionException(role: unknown, pathname: string): boolean {
  if (role !== 'ADMIN') return false;
  return (
    /^\/dashboard\/assistante\/students\/[^/]+\/candidat\/?$/.test(pathname)
    || /^\/dashboard\/assistante\/(assignments|planning)\/?$/.test(pathname)
    // Household/family operations (go-live mission §3, Lot 1A): the
    // underlying API/service layer already authorizes ADMIN via the
    // canonical capability matrix (every HOUSEHOLD, PARENT and STUDENT
    // capability is granted to ADMIN — lib/core-v2/rbac.ts), so this is a
    // routing gap, not a rights gap. Scoped to the families subtree only.
    || /^\/dashboard\/assistante\/familles(\/.*)?$/.test(pathname)
  );
}
