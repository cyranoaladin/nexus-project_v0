import { AriaError } from '@/lib/aria/kernel/errors';
import { makeRecordLearningEvidence } from '@/lib/aria/application/evidence/record';
import { makeListLearningEvidenceForStudent } from '@/lib/aria/application/evidence/list';
import type { LearningEvidenceRepository } from '@/lib/aria/application/evidence/ports';

const REAL_COURSE_KEY = 'eds-maths-premiere';
const REAL_SKILL_ID = 'ALG_SUITE_ARITH';

function fakeRepository(overrides: Partial<jest.Mocked<LearningEvidenceRepository>> = {}) {
  return {
    resolveStudentIdByUserId: jest.fn(),
    create: jest.fn(),
    listForStudent: jest.fn(),
    ...overrides,
  } as unknown as jest.Mocked<LearningEvidenceRepository>;
}

describe('recordLearningEvidence', () => {
  it('rejects an unknown courseKey before ever calling the repository', async () => {
    const repository = fakeRepository();
    const record = makeRecordLearningEvidence(repository);
    await expect(record({
      studentId: 'student-1',
      courseKey: 'not-a-real-course',
      skillId: null,
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-1',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-1' },
    })).rejects.toThrow(AriaError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a skillId that does not resolve for the given course', async () => {
    const repository = fakeRepository();
    const record = makeRecordLearningEvidence(repository);
    await expect(record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: 'NOT_A_REAL_SKILL',
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-1',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-1' },
    })).rejects.toThrow(AriaError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('accepts a null skillId (course-level evidence)', async () => {
    const repository = fakeRepository({
      create: jest.fn().mockResolvedValue({ id: 'evidence-1' }),
    });
    const record = makeRecordLearningEvidence(repository);
    await record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-1',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-1' },
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ skillId: null }));
  });

  it('rejects a malformed outcome for PRACTICE_ATTEMPT', async () => {
    const repository = fakeRepository();
    const record = makeRecordLearningEvidence(repository);
    await expect(record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-1',
      outcome: { outcome: 'MAYBE' },
    })).rejects.toThrow(AriaError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed outcome for TEACHER_OBSERVATION', async () => {
    const repository = fakeRepository();
    const record = makeRecordLearningEvidence(repository);
    await expect(record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: 'v1',
      source: 'TEACHER_OBSERVATION',
      sourceRefId: 'obs-1',
      outcome: { note: '' },
    })).rejects.toThrow(AriaError);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('validates the real skillId, then delegates to the repository with a defaulted observedAt', async () => {
    const repository = fakeRepository({
      create: jest.fn().mockResolvedValue({ id: 'evidence-2' }),
    });
    const record = makeRecordLearningEvidence(repository);
    const result = await record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-2',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-2' },
    });
    expect(result).toEqual({ id: 'evidence-2' });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: REAL_SKILL_ID,
      source: 'PRACTICE_ATTEMPT',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-2' },
      observedAt: expect.any(Date),
    }));
  });

  it('uses a caller-supplied observedAt when given, instead of defaulting to now', async () => {
    const repository = fakeRepository({
      create: jest.fn().mockResolvedValue({ id: 'evidence-3' }),
    });
    const record = makeRecordLearningEvidence(repository);
    const observedAt = new Date('2026-01-01T00:00:00.000Z');
    await record({
      studentId: 'student-1',
      courseKey: REAL_COURSE_KEY,
      skillId: null,
      curriculumVersion: 'v1',
      source: 'PRACTICE_ATTEMPT',
      sourceRefId: 'attempt-4',
      outcome: { outcome: 'CORRECT', activityAttemptId: 'attempt-4' },
      observedAt,
    });
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ observedAt }));
  });
});

describe('listLearningEvidenceForStudent', () => {
  it('rejects a non-ELEVE actor without ever calling the repository', async () => {
    const repository = fakeRepository();
    const list = makeListLearningEvidenceForStudent(repository);
    await expect(list({ actor: { userId: 'user-1', role: 'COACH' } })).rejects.toThrow(AriaError);
    expect(repository.resolveStudentIdByUserId).not.toHaveBeenCalled();
  });

  it('throws NOT_ENROLLED when the actor has no student record', async () => {
    const repository = fakeRepository({
      resolveStudentIdByUserId: jest.fn().mockResolvedValue(null),
    });
    const list = makeListLearningEvidenceForStudent(repository);
    await expect(list({ actor: { userId: 'user-1', role: 'ELEVE' } })).rejects.toThrow(AriaError);
    expect(repository.listForStudent).not.toHaveBeenCalled();
  });

  it('resolves the actor to their own studentId and delegates filters to the repository', async () => {
    const repository = fakeRepository({
      resolveStudentIdByUserId: jest.fn().mockResolvedValue('student-1'),
      listForStudent: jest.fn().mockResolvedValue([{ id: 'evidence-1' }]),
    });
    const list = makeListLearningEvidenceForStudent(repository);
    const result = await list({
      actor: { userId: 'user-1', role: 'ELEVE' },
      filters: { courseKey: REAL_COURSE_KEY },
    });
    expect(result).toEqual([{ id: 'evidence-1' }]);
    expect(repository.resolveStudentIdByUserId).toHaveBeenCalledWith('user-1');
    expect(repository.listForStudent).toHaveBeenCalledWith('student-1', { courseKey: REAL_COURSE_KEY });
  });

  it('defaults filters to an empty object when none are given', async () => {
    const repository = fakeRepository({
      resolveStudentIdByUserId: jest.fn().mockResolvedValue('student-1'),
      listForStudent: jest.fn().mockResolvedValue([]),
    });
    const list = makeListLearningEvidenceForStudent(repository);
    await list({ actor: { userId: 'user-1', role: 'ELEVE' } });
    expect(repository.listForStudent).toHaveBeenCalledWith('student-1', {});
  });
});
