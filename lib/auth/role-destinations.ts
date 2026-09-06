/** Navigation destinations only. Resource authorization remains in server guards. */
export const ROLE_DESTINATIONS = Object.freeze({
  ADMIN: '/dashboard/admin',
  ASSISTANTE: '/dashboard/assistante',
  COACH: '/dashboard/coach',
  PARENT: '/dashboard/parent',
  ELEVE: '/dashboard/eleve',
} as const);

export function getRoleDestination(role: unknown): string | undefined {
  return typeof role === 'string' && Object.prototype.hasOwnProperty.call(ROLE_DESTINATIONS, role)
    ? ROLE_DESTINATIONS[role as keyof typeof ROLE_DESTINATIONS]
    : undefined;
}
