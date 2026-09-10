import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseLearningEvidenceOutcome } from '../../domain/evidence/outcome';
import type {
  CreateLearningEvidenceInput,
  LearningEvidenceRecord,
  LearningEvidenceRepository,
  ListLearningEvidenceFilters,
} from '../../application/evidence/ports';

const learningEvidenceSelect = {
  id: true,
  studentId: true,
  courseKey: true,
  skillId: true,
  curriculumVersion: true,
  source: true,
  sourceRefId: true,
  outcome: true,
  observedAt: true,
  createdAt: true,
} satisfies Prisma.LearningEvidenceSelect;

type SelectedRow = Prisma.LearningEvidenceGetPayload<{ select: typeof learningEvidenceSelect }>;

function toRecord(row: SelectedRow): LearningEvidenceRecord {
  return Object.freeze({
    id: row.id,
    studentId: row.studentId,
    courseKey: row.courseKey,
    skillId: row.skillId,
    curriculumVersion: row.curriculumVersion,
    source: row.source,
    sourceRefId: row.sourceRefId,
    // Re-validated on read: the row was validated at write time by this
    // same schema, so this can only ever fail if the DB was written by
    // something other than `recordLearningEvidence` — surfacing that as a
    // real error is correct, not a defensive no-op.
    outcome: parseLearningEvidenceOutcome(row.source, row.outcome),
    observedAt: row.observedAt,
    createdAt: row.createdAt,
  });
}

class PrismaLearningEvidenceRepository implements LearningEvidenceRepository {
  constructor(private readonly client: PrismaClient) {}

  async resolveStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.client.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  async create(input: CreateLearningEvidenceInput): Promise<LearningEvidenceRecord> {
    const row = await this.client.learningEvidence.create({
      data: {
        studentId: input.studentId,
        courseKey: input.courseKey,
        skillId: input.skillId,
        curriculumVersion: input.curriculumVersion,
        source: input.source,
        sourceRefId: input.sourceRefId,
        outcome: input.outcome,
        observedAt: input.observedAt,
      },
      select: learningEvidenceSelect,
    });
    return toRecord(row);
  }

  async listForStudent(
    studentId: string,
    filters: ListLearningEvidenceFilters,
  ): Promise<readonly LearningEvidenceRecord[]> {
    const rows = await this.client.learningEvidence.findMany({
      where: {
        studentId,
        ...(filters.courseKey ? { courseKey: filters.courseKey } : {}),
        ...(filters.skillId ? { skillId: filters.skillId } : {}),
        ...(filters.source ? { source: filters.source } : {}),
      },
      select: learningEvidenceSelect,
      orderBy: { observedAt: 'desc' },
      take: filters.limit ?? 50,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    });
    return Object.freeze(rows.map(toRecord));
  }
}

export function makePrismaLearningEvidenceRepository(
  client: PrismaClient,
): LearningEvidenceRepository {
  return new PrismaLearningEvidenceRepository(client);
}

export const prismaLearningEvidenceRepository = makePrismaLearningEvidenceRepository(prisma);
