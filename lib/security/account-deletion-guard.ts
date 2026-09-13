/**
 * Shared mapping from the 11 `onDelete: Restrict` foreign keys added by
 * migration 20260913200000_restrict_account_delete_cascades to a clear,
 * actionable API error — used by every route that can end up trying to
 * hard-delete a User/Student/CoachProfile (currently
 * `DELETE /api/admin/users` and `DELETE /api/assistante/coaches/manage/[id]`).
 *
 * Before that migration, deleting a User with real history silently
 * cascade-deleted it (billing, academic enrollment, ARIA conversations/
 * evidence, session bookings, coach-student assignments, documents, coach
 * notes). Postgres now refuses the delete outright (P2003); this module
 * turns that low-level foreign-key violation into the same French,
 * staff-facing message regardless of which route triggered it — one
 * mapping, not two independently-maintained copies.
 */
import { Prisma } from '@prisma/client';
import { ApiError } from '@/lib/api/errors';

const RESTRICT_CONSTRAINT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  subscriptions_studentId_fkey: 'un historique d\'abonnement',
  student_academic_enrollments_studentId_fkey: 'un historique d\'inscription académique',
  aria_learning_evidence_studentId_fkey: 'des preuves d\'apprentissage ARIA',
  aria_conversations_studentId_fkey: 'des conversations ARIA',
  SessionBooking_studentId_fkey: 'des séances réservées (en tant qu\'élève)',
  SessionBooking_coachId_fkey: 'des séances réservées (en tant que coach)',
  user_documents_userId_fkey: 'des documents déposés',
  coach_notes_studentId_fkey: 'des notes de coach le concernant',
  coach_notes_coachId_fkey: 'des notes de coach rédigées par ce compte',
  coach_student_assignments_coachId_fkey: 'des affectations élève-coach (en tant que coach)',
  coach_student_assignments_studentId_fkey: 'des affectations élève-coach (en tant qu\'élève)',
});

function constraintNameFromMeta(meta: Record<string, unknown> | undefined): string | null {
  if (!meta) return null;
  const candidate = meta.constraint ?? meta.field_name ?? meta.target;
  if (typeof candidate === 'string') return candidate;
  if (Array.isArray(candidate) && typeof candidate[0] === 'string') return candidate[0];
  return null;
}

/**
 * Returns a ready-to-throw ApiError.conflict(...) if `error` is exactly
 * one of the 11 account-deletion Restrict violations this module knows
 * about; returns `null` for anything else (including P2003 violations on
 * unrelated constraints), so callers must always re-throw the original
 * error when this returns `null` — never assume every P2003 is this case.
 */
export function mapAccountDeletionRestrictError(error: unknown): ApiError | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2003') {
    return null;
  }
  const constraintName = constraintNameFromMeta(error.meta as Record<string, unknown> | undefined);
  const label = constraintName ? RESTRICT_CONSTRAINT_LABELS[constraintName] : undefined;
  if (!label) return null;
  return ApiError.conflict(
    `Impossible de supprimer ce compte : il a ${label}. Désactivez le compte plutôt que de le supprimer, ou traitez d'abord cet historique.`
  );
}
