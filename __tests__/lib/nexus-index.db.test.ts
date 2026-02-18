/**
 * @jest-environment node
 */

/**
 * Tests for lib/nexus-index.ts — DB-dependent functions (fetchIndexData, computeNexusIndex)
 *
 * Uses the global prisma mock from jest.setup.js
 */

import { fetchIndexData, computeNexusIndex } from '@/lib/nexus-index';

const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    student: { findUnique: jest.Mock };
    sessionBooking: { findMany: jest.Mock };
    sessionReport: { findMany: jest.Mock };
    ariaConversation: { count: jest.Mock };
    ariaMessage: { count: jest.Mock };
    diagnostic: { count: jest.Mock };
  };
};

describe('fetchIndexData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty data when student not found', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const result = await fetchIndexData('nonexistent');

    expect(result.student).toBeNull();
    expect(result.sessions).toEqual([]);
    expect(result.reports).toEqual([]);
    expect(result.ariaConversationCount).toBe(0);
    expect(result.ariaFeedbackCount).toBe(0);
    expect(result.diagnosticCount).toBe(0);
  });

  it('fetches all data when student exists', async () => {
    const student = { id: 'student-1', createdAt: new Date() };
    prisma.student.findUnique.mockResolvedValue(student);
    prisma.sessionBooking.findMany.mockResolvedValue([
      { status: 'COMPLETED', scheduledDate: new Date(), rating: 4, studentAttended: true, completedAt: new Date() },
    ]);
    prisma.sessionReport.findMany.mockResolvedValue([
      { performanceRating: 4, engagementLevel: 'HIGH', createdAt: new Date() },
    ]);
    prisma.ariaConversation.count.mockResolvedValue(3);
    prisma.ariaMessage.count.mockResolvedValue(5);
    prisma.diagnostic.count.mockResolvedValue(1);

    const result = await fetchIndexData('user-1');

    expect(result.student).toEqual(student);
    expect(result.sessions).toHaveLength(1);
    expect(result.reports).toHaveLength(1);
    expect(result.ariaConversationCount).toBe(3);
    expect(result.ariaFeedbackCount).toBe(5);
    expect(result.diagnosticCount).toBe(1);
  });
});

describe('computeNexusIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when student not found', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const result = await computeNexusIndex('nonexistent');
    expect(result).toBeNull();
  });

  it('returns index result when sufficient data exists', async () => {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);

    prisma.student.findUnique.mockResolvedValue({ id: 'student-1', createdAt: daysAgo(60) });
    prisma.sessionBooking.findMany.mockResolvedValue([
      { status: 'COMPLETED', scheduledDate: daysAgo(21), rating: 4, studentAttended: true, completedAt: daysAgo(21) },
      { status: 'COMPLETED', scheduledDate: daysAgo(14), rating: 4, studentAttended: true, completedAt: daysAgo(14) },
      { status: 'COMPLETED', scheduledDate: daysAgo(7), rating: 5, studentAttended: true, completedAt: daysAgo(7) },
    ]);
    prisma.sessionReport.findMany.mockResolvedValue([
      { performanceRating: 4, engagementLevel: 'HIGH', createdAt: daysAgo(7) },
    ]);
    prisma.ariaConversation.count.mockResolvedValue(2);
    prisma.ariaMessage.count.mockResolvedValue(3);
    prisma.diagnostic.count.mockResolvedValue(1);

    const result = await computeNexusIndex('user-1');

    expect(result).not.toBeNull();
    expect(result!.globalScore).toBeGreaterThanOrEqual(0);
    expect(result!.globalScore).toBeLessThanOrEqual(100);
    expect(result!.pillars).toHaveLength(4);
    expect(result!.level).toBeDefined();
    expect(result!.trend).toBeDefined();
  });

  it('returns null gracefully on DB error', async () => {
    prisma.student.findUnique.mockRejectedValue(new Error('DB connection failed'));

    const result = await computeNexusIndex('user-1');
    expect(result).toBeNull();
  });
});
