/**
 * Nexus Planning Studio — outil interne de planification hebdomadaire.
 *
 * L'outil est une application statique (public/planning) servie sur /planning.
 * Son accès est réservé au personnel : direction, assistante et enseignants.
 * Le planning partagé est persisté côté serveur (API /api/planning-studio) ;
 * les droits d'écriture sont vérifiés par le serveur, jamais seulement par
 * l'interface.
 */

export const PLANNING_STUDIO_PATH = '/planning';

export const PLANNING_STUDIO_ROLES = ['ADMIN', 'ASSISTANTE', 'COACH'] as const;

export type PlanningStudioRole = (typeof PLANNING_STUDIO_ROLES)[number];

export interface PlanningStudioPermissions {
  /** Consulter le planning, filtrer, imprimer, exporter. */
  canRead: boolean;
  /** Modifier séances, enseignants, salles, matières, groupes et enregistrer. */
  canEdit: boolean;
  /** Importer un fichier JSON comme nouvelle révision. */
  canImport: boolean;
  /** Consulter l'historique des révisions. */
  canViewHistory: boolean;
  /** Restaurer une révision antérieure. */
  canRestore: boolean;
  /** Réinitialiser au planning livré. */
  canReset: boolean;
}

export function isPlanningStudioPath(pathname: string): boolean {
  return pathname === PLANNING_STUDIO_PATH || pathname.startsWith(`${PLANNING_STUDIO_PATH}/`);
}

export function canAccessPlanningStudio(role: unknown): role is PlanningStudioRole {
  return typeof role === 'string' && (PLANNING_STUDIO_ROLES as readonly string[]).includes(role);
}

/**
 * Matrice des droits (miroir des politiques RBAC `planning-studio.*`) :
 * ADMIN tout ; ASSISTANTE lecture + édition + import ; COACH lecture seule.
 */
export function planningStudioPermissions(role: unknown): PlanningStudioPermissions {
  const r = typeof role === 'string' ? role : '';
  const isAdmin = r === 'ADMIN';
  const isStaffEditor = isAdmin || r === 'ASSISTANTE';
  return {
    canRead: canAccessPlanningStudio(r),
    canEdit: isStaffEditor,
    canImport: isStaffEditor,
    canViewHistory: isAdmin,
    canRestore: isAdmin,
    canReset: isAdmin,
  };
}
