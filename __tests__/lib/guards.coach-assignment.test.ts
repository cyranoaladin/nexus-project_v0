/**
 * requireCoachAssignedToStudent — regression test.
 *
 * CoachStudentAssignment.coachId references CoachProfile.id, which is
 * distinct from User.id. A prior version of this guard compared a coachUserId
 * directly against coachId, which meant the check could never match a real
 * assignment (fail-closed for the wrong reason) — it must resolve through the
 * coach relation instead. Guards data access for a diagnostic feature that
 * includes a minor's records, so id-space correctness here is non-negotiable.
 *
 * Source: lib/guards.ts
 */

const mockFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    coachStudentAssignment: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: jest.fn().mockResolvedValue(body),
      status: init?.status || 200,
      headers: new Map(),
    })),
  },
}));

import { requireCoachAssignedToStudent } from '@/lib/guards';

describe('requireCoachAssignedToStudent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authorizes a coach with an active assignment to the student', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'assignment-1' });

    const result = await requireCoachAssignedToStudent('user-coach-1', 'student-1');

    expect(result).toBe(true);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { studentId: 'student-1', status: 'ACTIVE', coach: { userId: 'user-coach-1' } },
      select: { id: true },
    });
  });

  it('denies a coach with no assignment to the student (403)', async () => {
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await requireCoachAssignedToStudent('user-coach-2', 'student-1');

    expect(result).not.toBe(true);
    expect((result as any).status).toBe(403);
  });

  it('denies a non-coach actor (no matching CoachProfile at all) with 403', async () => {
    // A parent/student userId has no CoachProfile, so the relation filter
    // never matches — the query itself proves it, no separate role check needed.
    mockFindFirst.mockResolvedValueOnce(null);

    const result = await requireCoachAssignedToStudent('user-parent-not-a-coach', 'student-1');

    expect(result).not.toBe(true);
    expect((result as any).status).toBe(403);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { studentId: 'student-1', status: 'ACTIVE', coach: { userId: 'user-parent-not-a-coach' } },
      select: { id: true },
    });
  });
});
