
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { completeSession } from '../../lib/credits';

// Mock Prisma
const mockTx = {
    sessionBooking: {
        findUnique: vi.fn(),
        update: vi.fn(),
    },
    sessionReport: {
        create: vi.fn(),
    }
};

const mockPrisma = {
    $transaction: vi.fn((callback) => callback(mockTx)),
    sessionBooking: mockTx.sessionBooking,
    sessionReport: mockTx.sessionReport
};

// Mock the prisma module at the source.
// We mock both alias and relative path to be sure.
vi.mock('@/lib/prisma', () => ({
    prisma: mockPrisma
}));
vi.mock('../../lib/prisma', () => ({
    prisma: mockPrisma
}));


describe('completeSession', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should transition session from BOOKED to COMPLETED', async () => {
        // Setup
        const sessionId = 'session-123';
        const sessionData = {
            id: sessionId,
            status: 'BOOKED',
            title: 'Math Session',
            studentId: 'student-1',
            coachId: 'coach-1',
            student: { id: 'student-1' },
            coach: { id: 'coach-1' }
        };

        mockTx.sessionBooking.findUnique.mockResolvedValue(sessionData);
        mockTx.sessionReport.create.mockResolvedValue({ id: 'report-1' });
        mockTx.sessionBooking.update.mockResolvedValue({ ...sessionData, status: 'COMPLETED' });

        const reportData = {
            summary: "Good session",
            topicsCovered: "Algebra",
            performanceRating: 4,
            attendance: true,
            engagementLevel: "HIGH" as const
        };

        // Execute
        // Note: In a real environment with robust mocking for dynamic imports, this would be cleaner.
        // Here we rely on the fact that the test runner environment (vitest) can generally handle module mocks.
        // If dynamic import fails to pick up the mock, we might need a workaround.
        // For now, let's assume standard behavior.
        // Wait, 'credits.ts' uses `await import('./prisma')`. If we mock `./prisma` path, it should work.

        // We need to properly mock the relative import
        vi.doMock('./prisma', () => ({ prisma: mockPrisma }));

        // Re-import to pick up mock? Dynamic import happens at runtime, so doMock might work if called before function execution.

        // Let's try to run it. If it fails on import, we know why.

        const result = await completeSession(sessionId, reportData);

        // Assert
        expect(mockTx.sessionBooking.findUnique).toHaveBeenCalledWith({
            where: { id: sessionId },
            include: { student: true, coach: true }
        });

        expect(mockTx.sessionReport.create).toHaveBeenCalled();
        expect(mockTx.sessionBooking.update).toHaveBeenCalledWith({
            where: { id: sessionId },
            data: expect.objectContaining({
                status: 'COMPLETED',
                completedAt: expect.any(Date)
            })
        });

        expect(result.session.status).toBe('COMPLETED');
    });
});
