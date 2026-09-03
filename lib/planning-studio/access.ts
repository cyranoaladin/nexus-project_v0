/**
 * Nexus Planning Studio — outil interne de planification hebdomadaire.
 *
 * L'outil est une application statique (public/planning) servie sur /planning.
 * Son accès est réservé au personnel : direction, assistante et enseignants.
 * Chaque utilisateur travaille sur une copie locale (navigateur) du planning ;
 * aucune donnée n'est écrite côté serveur.
 */

export const PLANNING_STUDIO_PATH = '/planning';

export const PLANNING_STUDIO_ROLES = ['ADMIN', 'ASSISTANTE', 'COACH'] as const;

export type PlanningStudioRole = (typeof PLANNING_STUDIO_ROLES)[number];

export function isPlanningStudioPath(pathname: string): boolean {
  return pathname === PLANNING_STUDIO_PATH || pathname.startsWith(`${PLANNING_STUDIO_PATH}/`);
}

export function canAccessPlanningStudio(role: unknown): role is PlanningStudioRole {
  return typeof role === 'string' && (PLANNING_STUDIO_ROLES as readonly string[]).includes(role);
}
