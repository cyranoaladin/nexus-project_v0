import type { LearningEvidenceSource } from '@prisma/client';
import type { LearningEvidenceOutcome } from '../../domain/evidence/outcome';

export interface LearningEvidenceRecord {
  readonly id: string;
  readonly studentId: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly source: LearningEvidenceSource;
  readonly sourceRefId: string;
  readonly outcome: LearningEvidenceOutcome;
  readonly observedAt: Date;
  readonly createdAt: Date;
}

export interface CreateLearningEvidenceInput {
  readonly studentId: string;
  readonly courseKey: string;
  readonly skillId: string | null;
  readonly curriculumVersion: string;
  readonly source: LearningEvidenceSource;
  readonly sourceRefId: string;
  readonly outcome: LearningEvidenceOutcome;
  readonly observedAt: Date;
}

export interface ListLearningEvidenceFilters {
  readonly courseKey?: string;
  readonly skillId?: string;
  readonly source?: LearningEvidenceSource;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Persistence port for LearningEvidence — implemented by
 * `infrastructure/prisma/learning-evidence-repository.ts`. Keeping this as
 * an interface (rather than the application layer calling Prisma directly)
 * matches the established pattern in `application/profile/public.ts` /
 * `infrastructure/prisma/profile-repository.ts`.
 */
export interface LearningEvidenceRepository {
  /** Real internal `Student.id` for a given `User.id`, or null if none. */
  resolveStudentIdByUserId(userId: string): Promise<string | null>;
  create(input: CreateLearningEvidenceInput): Promise<LearningEvidenceRecord>;
  listForStudent(
    studentId: string,
    filters: ListLearningEvidenceFilters,
  ): Promise<readonly LearningEvidenceRecord[]>;
}
