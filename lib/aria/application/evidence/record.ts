/**
 * Internal write path for LearningEvidence — NEVER reachable from an HTTP
 * handler. Called only by other server-side domain services (future
 * Practice/Correction/conversation-assessment code) that already hold a
 * real, resolved `studentId`. A client-writable "record your own evidence"
 * endpoint would be a real integrity hole (a student could fabricate
 * mastery signals), so this module deliberately has no route.
 */
import type { LearningEvidenceSource } from '@prisma/client';
import { getCourse } from '@/lib/curriculum/catalog';
import { getSkill } from '../../curriculum/skill-graph';
import { AriaError } from '../../kernel/errors';
import { parseLearningEvidenceOutcome } from '../../domain/evidence/outcome';
import { prismaLearningEvidenceRepository } from '../../infrastructure/prisma/learning-evidence-repository';
import type { LearningEvidenceRecord, LearningEvidenceRepository } from './ports';

export interface RecordLearningEvidenceInput {
  readonly studentId: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly source: LearningEvidenceSource;
  readonly sourceRefId: string;
  readonly outcome: unknown;
  readonly observedAt?: Date;
}

export function makeRecordLearningEvidence(repository: LearningEvidenceRepository) {
  return async function recordLearningEvidence(
    input: RecordLearningEvidenceInput,
  ): Promise<LearningEvidenceRecord> {
    if (!getCourse(input.courseKey)) {
      throw new AriaError('COURSE_NOT_FOUND', 404, 'Cours ARIA introuvable.');
    }
    if (input.skillId !== null && !getSkill(input.courseKey, input.skillId)) {
      throw new AriaError('SKILL_MISMATCH', 400, 'La compétence ne correspond pas au cours demandé.');
    }
    const outcome = parseLearningEvidenceOutcome(input.source, input.outcome);
    return repository.create({
      studentId: input.studentId,
      courseKey: input.courseKey,
      skillId: input.skillId,
      curriculumVersion: input.curriculumVersion,
      source: input.source,
      sourceRefId: input.sourceRefId,
      outcome,
      observedAt: input.observedAt ?? new Date(),
    });
  };
}

export const recordLearningEvidence = makeRecordLearningEvidence(prismaLearningEvidenceRepository);
