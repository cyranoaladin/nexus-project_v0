/**
 * Extracteur Core v2 — SQUELETTE (mission "Core v2 Canonical Architecture", §17).
 *
 * NON EXÉCUTABLE EN L'ÉTAT contre une vraie base : les fonctions `extract*`
 * lèvent délibérément `NOT_IMPLEMENTED`. Ce fichier fixe le CONTRAT (entrées,
 * sorties, manifest, ordre, garde-fous) avant que la moindre ligne de
 * transformation réelle soit écrite — pour que la revue porte sur la forme
 * du contrat, pas sur une implémentation qu'on découvrirait après coup.
 *
 * Invariants non négociables (mission §17-19) :
 *   - SOURCE (`nexus_prod`) est ouverte STRICTEMENT en lecture. Aucune
 *     fonction ici ne doit jamais écrire dans le client source.
 *   - Déterministe : mêmes entrées (backup SHA + roster digest) → même sortie.
 *     Jamais d'horloge/aléatoire dans la logique de sélection/transformation
 *     (seul le manifest de sortie porte un timestamp, pour l'audit).
 *   - Jamais de dual-write : ce script écrit UNE fois dans `nexus_core_v2`,
 *     jamais dans les deux bases à la fois pendant le runtime applicatif.
 *   - Ne migre QUE le roster `ROSTER_2026_2027_APPROVED` (jamais les
 *     candidats non approuvés, jamais un "au cas où").
 *   - Aucune ancienne `CoachStudentAssignment` (subjects[]/academicCourseKeys[]/
 *     courseScopeState) n'est copiée telle quelle — Phase G (REBUILD, pas
 *     backfill aveugle) : une `CoachStudentCourseAssignment` v2 ne naît que
 *     d'une vérité actuelle explicite (voir `MigrationPolicy.assignments`).
 */

import type { RosterCandidateReport } from './generate-roster-candidates';

// ── Contrat d'entrée ─────────────────────────────────────────────────────────

export interface MigrationInputs {
  /** SHA256 du backup source utilisé (mission §17: "source backup SHA"). */
  readonly sourceBackupSha256: string;
  /** Empreinte du schéma source au moment de l'extraction (ex: hash du
   *  dernier nom de migration `_prisma_migrations` appliqué). */
  readonly sourceSchemaFingerprint: string;
  /** Version du schéma cible Core v2 (ex: nom de la migration baseline). */
  readonly targetSchemaVersion: string;
  /**
   * Digest (hash) du fichier roster APPROUVÉ par le propriétaire — jamais le
   * candidat brut. Calculé sur le sous-ensemble `ROSTER_2026_2027_APPROVED`
   * uniquement, pour que toute divergence entre ce qui a été approuvé et ce
   * qui est réellement migré soit détectable après coup.
   */
  readonly approvedRosterDigest: string;
  /** studentId → true pour les élèves explicitement approuvés. Jamais dérivé
   *  implicitement du fichier `.candidate.json` — doit venir d'un fichier
   *  d'APPROBATION séparé, produit par un acte humain (mission §13). */
  readonly approvedStudentIds: ReadonlySet<string>;
}

// ── Contrat de sortie ────────────────────────────────────────────────────────

export interface MigrationManifest {
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly inputs: MigrationInputs;
  readonly counts: {
    readonly rowsSelected: number;
    readonly rowsTransformed: number;
    readonly rowsSkipped: number;
    readonly rowsRejected: number;
  };
  readonly perEntity: readonly EntityMigrationResult[];
  /** Toute divergence entre `approvedStudentIds` et ce qui a réellement été
   *  écrit doit apparaître ici — jamais silencieuse. Liste vide = attendu. */
  readonly anomalies: readonly string[];
}

export interface EntityMigrationResult {
  readonly entity:
    | 'User'
    | 'Household'
    | 'HouseholdParent'
    | 'Student'
    | 'StudentAcademicYearEnrollment'
    | 'CoachProfile'
    | 'CoachCourseCapability'
    | 'StudentCourseEnrollment'
    | 'CoachStudentCourseAssignment'
    | 'PlanningSeries'
    | 'SessionBooking'
    | 'Subscription'
    | 'Entitlement'
    | 'FinancialHistory';
  readonly selected: number;
  readonly transformed: number;
  readonly skipped: number;
  readonly rejected: number;
  readonly rejectionReasons: readonly string[];
}

// ── Politique de migration (mission §18) — ce qui migre, ce qui ne migre pas ─
//
// Documentée ici comme contrat lisible en revue, appliquée par les fonctions
// `extract*` une fois implémentées (actuellement NOT_IMPLEMENTED).

export const MigrationPolicy = {
  migrates: [
    'APPROVED 2026-2027 roster (StudentAcademicYearEnrollment ACTIVE, un par élève approuvé)',
    'Households/HouseholdParents des élèves approuvés uniquement',
    'Coaches nécessaires (ceux ayant au moins une capability/assignment réelle vers le roster approuvé)',
    'CoachCourseCapabilities confirmées (dérivées de CoachProfile.subjects × catalogue, jamais copiées telles quelles sans le mapping)',
    'StudentCourseEnrollments confirmés (source=ADMIN/ASSISTANTE/SEED — jamais BACKFILL_LEGACY_SPECIALTIES sans revue)',
    'CoachStudentCourseAssignments — REBUILD depuis une vérité actuelle explicite, jamais copie de courseScopeState=BACKFILL_*',
    'Future PlanningSeries/SessionBookings liés à une assignment migrée',
    'Subscriptions actives couvrant 2026-2027',
    'Financial history nécessaire (Payment/Invoice/Entitlement — conservés indépendamment du bucket roster, cf. §13 finance du rapport)',
  ],
  doesNotMigrateAutomatically: [
    'Legacy assignments ambiguës ou vides (courseScopeState=BACKFILL_UNRESOLVED/BACKFILL_AMBIGUOUS)',
    'Élèves hors roster approuvé (NOT_MIGRATED, y compris les élèves Case A et Case B tant qu\'aucune preuve indépendante 2026-2027 n\'existe)',
    'Anciennes sessions pédagogiques (modèle Session legacy — SESSION_LEGACY_RUNTIME_CONSUMERS=0, confirmé, non importé sauf besoin d\'archive explicite)',
    'Comptes de test / invitations obsolètes / état de feature flags morts',
  ],
} as const;

// ── Fonctions d'extraction — squelette, non implémenté ──────────────────────

async function extractApprovedRoster(
  _inputs: MigrationInputs,
  _report: RosterCandidateReport,
): Promise<EntityMigrationResult> {
  throw new Error('NOT_IMPLEMENTED — extractApprovedRoster requires an owner-approved roster file, not yet produced');
}

// D'autres fonctions extract{Households,CoachCapabilities,Assignments,...}
// suivront le même contrat une fois le roster approuvé existe — non
// esquissées individuellement ici pour éviter de figer une forme avant que
// la première (`extractApprovedRoster`) ait été implémentée et revue.

export async function runExtraction(_inputs: MigrationInputs): Promise<MigrationManifest> {
  throw new Error(
    'NOT_IMPLEMENTED — this is a design-time skeleton (mission §17). ' +
      'It must not run against any real database until: (1) a roster is ' +
      'explicitly approved by the owner, (2) each extract* function above ' +
      'is implemented and covered by its own tests, (3) this file is reviewed ' +
      'in a follow-up PR distinct from this architecture-design PR.',
  );
}
