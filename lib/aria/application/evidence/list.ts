/**
 * Read path for LearningEvidence — domain-layer only, no HTTP route yet.
 * Ready for a future route to call once there's a real consumer (e.g. the
 * cockpit's "recent results" panel, in a later lot).
 *
 * Today this ONLY supports the student reading their own evidence
 * (`resolveInteractiveStudentActor` throws for any role other than ELEVE).
 * Parent/coach access to a student's evidence is explicitly future scope —
 * a later lot must add its own authorization path, never widen this one.
 */
import { resolveInteractiveStudentActor } from '../../kernel/actor-subject';
import { AriaError } from '../../kernel/errors';
import { prismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
import type {
  LearningEvidenceRecord,
  LearningEvidenceRepository,
  ListLearningEvidenceFilters,
} from './ports';

export function makeListLearningEvidenceForStudent(repository: LearningEvidenceRepository) {
  return async function listLearningEvidenceForStudent(
    input: Readonly<{
      actor: { readonly userId: string; readonly role: string };
      filters?: ListLearningEvidenceFilters;
    }>,
  ): Promise<readonly LearningEvidenceRecord[]> {
    const actor = resolveInteractiveStudentActor(input.actor);
    const studentId = await repository.resolveStudentIdByUserId(actor.userId);
    if (!studentId) {
      throw new AriaError('NOT_ENROLLED', 403, 'Profil élève introuvable.');
    }
    return repository.listForStudent(studentId, input.filters ?? {});
  };
}

export const listLearningEvidenceForStudent = makeListLearningEvidenceForStudent(
  prismaLearningEvidenceRepository,
);
