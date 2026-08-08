/**
 * Effacement RGPD : anonymisation des porteurs mutables.
 *
 * La chaîne append-only du bilan est **déjà pseudonyme** — vérifié sur les
 * octets réellement stockés en production. Elle ne contient donc aucune donnée
 * à effacer, et n'est jamais touchée ici : ni suppression, ni mise à jour, ni
 * contournement de trigger. Ce qui rend une personne identifiable vit
 * exclusivement dans les tables **mutables**, et c'est là qu'on agit.
 *
 * L'effacement est une **anonymisation en place**, pas une suppression. Les
 * lignes sont conservées : l'intégrité référentielle tient, les contraintes
 * `RESTRICT` ne gênent pas, et le squelette d'audit — qu'un bilan a eu lieu,
 * quand, validé par qui — reste vrai sans que personne ne soit identifiable.
 *
 * Deux familles de porteurs, établies par l'audit GATE 0 :
 *
 * - ceux qu'une clé étrangère relie au sujet, atteignables mécaniquement ;
 * - les **orphelins**, que seule une correspondance sur le nom, l'e-mail ou le
 *   téléphone permet de retrouver. Cette correspondance est **heuristique** —
 *   homonymes, adresse familiale partagée — donc jamais appliquée sans
 *   confirmation humaine.
 */

/** Valeur de remplacement d'un identifiant effacé. Reconnaissable, non réversible. */
export const TOMBSTONE = '[anonymisé]' as const;

/** Adresse de remplacement, unique par sujet pour ne pas violer les contraintes d'unicité. */
export function tombstoneEmail(subjectRef: string): string {
  return `anonymise+${subjectRef}@invalid.local`;
}

export type CarrierKind = 'FOREIGN_KEY' | 'ORPHAN_MATCH';

export type CarrierTarget = Readonly<{
  table: string;
  /** Colonnes portant un identifiant direct, remplacées par un tombstone. */
  identityColumns: readonly string[];
  /** Colonnes portant un jeton ou un quasi-secret, mises à nul. */
  secretColumns?: readonly string[];
  kind: CarrierKind;
}>;

/**
 * Périmètre d'anonymisation, issu de l'audit GATE 0.
 *
 * Les porteurs `ORPHAN_MATCH` n'ont aucune clé étrangère vers le sujet : une
 * routine indexée sur l'identifiant les manquerait intégralement. Ils sont donc
 * listés explicitement, et traités par proposition.
 */
export const ANONYMISATION_SCOPE: readonly CarrierTarget[] = Object.freeze([
  Object.freeze({
    table: 'users',
    identityColumns: Object.freeze(['email', 'firstName', 'lastName', 'phone']),
    secretColumns: Object.freeze(['password', 'activationToken', 'totpSecret', 'totpBackupCodes']),
    kind: 'FOREIGN_KEY' as const,
  }),
  Object.freeze({
    table: 'students',
    identityColumns: Object.freeze(['school', 'birthDate', 'survivalModeReason']),
    kind: 'FOREIGN_KEY' as const,
  }),
  Object.freeze({
    table: 'parent_profiles',
    identityColumns: Object.freeze(['address', 'city']),
    kind: 'FOREIGN_KEY' as const,
  }),
  Object.freeze({
    table: 'user_documents',
    identityColumns: Object.freeze(['title', 'originalName', 'description', 'localPath']),
    kind: 'FOREIGN_KEY' as const,
  }),
  Object.freeze({
    table: 'candidate_diagnostic_documents',
    identityColumns: Object.freeze(['title', 'originalName', 'description', 'reviewNote']),
    kind: 'FOREIGN_KEY' as const,
  }),
  // Orphelins : aucune clé étrangère ne mène à eux.
  Object.freeze({
    table: 'assessments',
    identityColumns: Object.freeze(['studentName', 'studentEmail', 'studentPhone', 'ipAddress', 'userAgent']),
    kind: 'ORPHAN_MATCH' as const,
  }),
  Object.freeze({
    table: 'bilans',
    identityColumns: Object.freeze(['studentName', 'studentEmail', 'studentPhone']),
    kind: 'ORPHAN_MATCH' as const,
  }),
  Object.freeze({
    table: 'contact_leads',
    identityColumns: Object.freeze(['name', 'email', 'phone', 'notes']),
    kind: 'ORPHAN_MATCH' as const,
  }),
  Object.freeze({
    table: 'stage_reservations',
    identityColumns: Object.freeze(['parentName', 'studentName', 'email', 'phone', 'notes']),
    secretColumns: Object.freeze(['activationToken']),
    kind: 'ORPHAN_MATCH' as const,
  }),
  Object.freeze({
    table: 'invoices',
    identityColumns: Object.freeze(['customerName', 'customerEmail', 'customerAddress']),
    kind: 'ORPHAN_MATCH' as const,
  }),
]);

export type ProposedRow = Readonly<{
  table: string;
  rowId: string;
  kind: CarrierKind;
  /** Vrai pour une correspondance par chaîne : à confirmer par un humain. */
  heuristic: boolean;
  /** Ce qui a permis de rapprocher la ligne du sujet, pour que l'humain juge. */
  matchedOn?: string;
}>;

export type AnonymisationProposal = Readonly<{
  subjectRef: string;
  rows: readonly ProposedRow[];
  files: readonly string[];
  /** Vrai dès qu'une ligne repose sur une correspondance heuristique. */
  requiresHumanConfirmation: boolean;
}>;

/**
 * Assemble la proposition. Rien n'est écrit : c'est un document soumis à
 * décision, et il l'est **toujours** dès qu'un rapprochement heuristique entre
 * en jeu.
 */
export function buildProposal(input: Readonly<{
  subjectRef: string;
  rows: readonly ProposedRow[];
  files: readonly string[];
}>): AnonymisationProposal {
  return Object.freeze({
    subjectRef: input.subjectRef,
    rows: Object.freeze([...input.rows]),
    files: Object.freeze([...input.files]),
    requiresHumanConfirmation: input.rows.some((row) => row.heuristic),
  });
}

/** Tables de la chaîne append-only. Aucune ne doit jamais figurer au périmètre. */
export const APPEND_ONLY_TABLES: readonly string[] = Object.freeze([
  'canonical_assessment_attempts',
  'canonical_score_snapshots',
  'canonical_evidence_items',
  'canonical_report_revisions',
  'canonical_report_artifacts',
  'canonical_report_materializations',
  'canonical_report_audience_artifacts',
  'canonical_report_reviews',
]);

/**
 * Date d'échéance de conservation : douze mois après la dernière activité.
 * La notice fixe cette règle ; c'est elle que la purge applique.
 */
export function retentionDueDate(lastActivityAt: Date, months: number): Date {
  const due = new Date(lastActivityAt);
  due.setUTCMonth(due.getUTCMonth() + months);
  return due;
}

/** L'échéance est-elle atteinte ? */
export function isRetentionExpired(lastActivityAt: Date | null, months: number, now: Date): boolean {
  // Sans date d'activité connue, on ne purge pas : mieux vaut conserver à tort
  // que supprimer les données de quelqu'un sur une inconnue.
  if (!lastActivityAt) return false;
  return retentionDueDate(lastActivityAt, months).getTime() <= now.getTime();
}
