/**
 * Comptes et groupes de VALIDATION technique (fumées de production).
 *
 * Les élèves techniques `val.*` sont inscrits au seul groupe `validation-technique`. Ce groupe est l'attribut de domaine
 * qui les isole : aucun filtre sur un préfixe d'identifiant. Les vues d'ensemble d'un ADMIN (qui n'est affecté à aucun
 * groupe et verrait donc tout) l'excluent par défaut, de sorte qu'ils ne comptent ni dans les effectifs, ni dans la file
 * « À corriger », ni dans l'activité récente, ni dans les statistiques de progression.
 *
 * - Un COACH n'est concerné que par ses affectations : l'enseignant technique `val.prof*`, affecté à ce groupe, le voit ;
 *   un enseignant réel ne l'est pas.
 * - Un accès explicite par identifiant (un travail, un élève, un export) reste possible : l'audit n'est pas bloqué.
 * - `includeValidation: true` réintègre explicitement ces comptes dans une vue d'ensemble (audit administratif).
 */
export const VALIDATION_GROUP_SLUG = 'validation-technique';

export interface ValidationScopeOptions {
  /** Audit administratif : réintègre le groupe de validation dans les vues d'ensemble d'un ADMIN. */
  includeValidation?: boolean;
}

/** Critère Prisma sur un groupe : tout groupe sauf le groupe de validation. */
export const notValidationGroup = { slug: { not: VALIDATION_GROUP_SLUG } } as const;

/** Critère Prisma sur un élève : jamais inscrit au groupe de validation. */
export const notValidationStudent = { espaceEnrollments: { none: { group: { slug: VALIDATION_GROUP_SLUG } } } } as const;
