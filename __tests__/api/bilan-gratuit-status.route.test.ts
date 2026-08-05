jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    canonicalAssessmentAttempt: { findFirst: jest.fn() },
  },
}));

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { GET } from '@/app/api/bilan-gratuit/status/route';

const mockAuth = auth as jest.Mock;
const mockFindProfile = prisma.parentProfile.findUnique as jest.Mock;
const mockFindAttempt = prisma.canonicalAssessmentAttempt.findFirst as jest.Mock;

describe('GET /api/bilan-gratuit/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns completed:false, dismissed:false when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: false, dismissed: false });
    expect(mockFindProfile).not.toHaveBeenCalled();
  });

  test('returns completed:false when the parent has no PUBLISHED attempt for any child', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-1' } });
    mockFindProfile.mockResolvedValue({ id: 'profile-1', bilanGratuitDismissedAt: null });
    mockFindAttempt.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: false, dismissed: false });
    expect(mockFindAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          student: expect.objectContaining({ parentId: 'profile-1' }),
        }),
      }),
    );
  });

  test('returns completed:true once at least one child has a PUBLISHED bilan', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-1' } });
    mockFindProfile.mockResolvedValue({ id: 'profile-1', bilanGratuitDismissedAt: null });
    mockFindAttempt.mockResolvedValue({ id: 'attempt-1' });

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: true, dismissed: false });
  });

  test('still reports dismissed from ParentProfile.bilanGratuitDismissedAt', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'parent-1' } });
    mockFindProfile.mockResolvedValue({ id: 'profile-1', bilanGratuitDismissedAt: new Date('2026-08-01T00:00:00.000Z') });
    mockFindAttempt.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toEqual({ completed: false, dismissed: true });
  });
});
