import { resolveCanonicalRunnerAccess } from '@/lib/bilans/passation/runner-access';

const attempt = {
  id: 'attempt-1',
  studentId: 'student-1',
  status: 'DRAFT',
  expiresAt: new Date('2026-08-17T10:00:00.000Z'),
  assessmentPackId: 'entree-terminale-maths-v1',
  assessmentPackVersion: '1',
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    findStudent: jest.fn().mockResolvedValue({ id: 'student-1' }),
    findAttempt: jest.fn().mockResolvedValue(attempt),
    resolvePack: jest.fn().mockReturnValue({ pack: { slug: attempt.assessmentPackId } }),
    now: () => new Date('2026-08-17T09:00:00.000Z'),
    ...overrides,
  } as never;
}

describe('Canonical runner server seam', () => {
  test('returns READY only for the owning student and an enabled pack', async () => {
    await expect(resolveCanonicalRunnerAccess({ attemptId: attempt.id, userId: 'user-1', role: 'ELEVE' }, dependencies()))
      .resolves.toEqual({ state: 'READY', attemptId: attempt.id });
  });

  test('returns WAITING when the attempt is owned but its pack flag is off', async () => {
    await expect(resolveCanonicalRunnerAccess(
      { attemptId: attempt.id, userId: 'user-1', role: 'ELEVE' },
      dependencies({ resolvePack: jest.fn().mockReturnValue(null) }),
    )).resolves.toEqual({ state: 'WAITING' });
  });

  test.each([
    ['non student role', { attemptId: attempt.id, userId: 'user-1', role: 'PARENT' }],
    ['missing attempt id', { attemptId: '', userId: 'user-1', role: 'ELEVE' }],
  ])('fails closed with NOT_FOUND for %s', async (_label, input) => {
    await expect(resolveCanonicalRunnerAccess(input as never, dependencies())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('fails closed with NOT_FOUND for an unowned or expired attempt', async () => {
    await expect(resolveCanonicalRunnerAccess(
      { attemptId: attempt.id, userId: 'user-1', role: 'ELEVE' },
      dependencies({ findAttempt: jest.fn().mockResolvedValue(null) }),
    )).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
