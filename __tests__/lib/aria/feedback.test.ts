import { AriaError } from '@/lib/aria/errors';
import {
  ARIA_FEEDBACK_CONCURRENCY_POLICY,
  makeRecordAriaFeedback,
} from '@/lib/aria/application/feedback/public';

describe('ARIA canonical feedback application use case', () => {
  const repository = {
    upsertOwnedFeedback: jest.fn(),
  };
  const recordFeedback = makeRecordAriaFeedback(repository);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('declares LAST_COMMITTED_WRITE_WINS as its explicit concurrency policy', () => {
    expect(ARIA_FEEDBACK_CONCURRENCY_POLICY).toBe('LAST_COMMITTED_WRITE_WINS');
  });

  it('resolves the interactive actor and delegates one canonical atomic upsert', async () => {
    repository.upsertOwnedFeedback.mockResolvedValueOnce({
      id: 'feedback-1',
      studentId: 'student-1',
      messageId: 'message-1',
      useful: true,
      reason: 'Utile',
      updatedAt: new Date('2026-08-30T18:00:00.000Z'),
    });

    await expect(recordFeedback({
      actor: { userId: 'user-1', role: 'ELEVE' },
      messageId: 'message-1',
      useful: true,
      reason: 'Utile',
    })).resolves.toEqual({
      id: 'feedback-1',
      subjectStudentId: 'student-1',
      messageId: 'message-1',
      useful: true,
      reason: 'Utile',
      updatedAt: '2026-08-30T18:00:00.000Z',
    });

    expect(repository.upsertOwnedFeedback).toHaveBeenCalledTimes(1);
    expect(repository.upsertOwnedFeedback).toHaveBeenCalledWith({
      actorUserId: 'user-1',
      messageId: 'message-1',
      useful: true,
      reason: 'Utile',
    });
  });

  it('rejects non-student actors before persistence', async () => {
    await expect(recordFeedback({
      actor: { userId: 'parent-1', role: 'PARENT' },
      messageId: 'message-1',
      useful: true,
    })).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    expect(repository.upsertOwnedFeedback).not.toHaveBeenCalled();
  });

  it('does not swallow ownership or database failures', async () => {
    const failure = new AriaError('INTERNAL_ERROR', 500, 'safe', {
      operation: 'upsertOwnedFeedback',
    });
    repository.upsertOwnedFeedback.mockRejectedValueOnce(failure);

    await expect(recordFeedback({
      actor: { userId: 'user-1', role: 'ELEVE' },
      messageId: 'message-1',
      useful: false,
    })).rejects.toBe(failure);
  });
});
