/**
 * Cale de portage : la release de production (724f8982d) ne contient pas encore
 * `lib/timezone.ts` (autorité de fuseau introduite plus tard sur main). Elle expose
 * le seul symbole dont l'espace pédagogique a besoin. Sur main, ce fichier est
 * l'autorité complète : ne PAS porter cette cale vers main.
 */
export function getOrganizationTimezone(): string {
  return process.env.NEXUS_ORGANIZATION_TIMEZONE || 'Africa/Tunis';
}
