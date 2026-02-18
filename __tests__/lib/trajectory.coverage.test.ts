/**
 * @jest-environment node
 */

/**
 * Tests for lib/trajectory.ts — DB functions via prisma mock
 *
 * Covers: createTrajectory, getActiveTrajectory, completeMilestone,
 * updateTrajectoryStatus, enrichTrajectory (private, tested via public API)
 */

import {
  createTrajectory,
  getActiveTrajectory,
  completeMilestone,
  updateTrajectoryStatus,
  parseMilestones,
} from '@/lib/trajectory';

// Access the mocked prisma
const { prisma } = jest.requireMock('@/lib/prisma') as {
  prisma: {
    trajectory: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
};

describe('Trajectory Engine — DB functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseTraj = {
    id: 'traj-1',
    title: 'Objectif Bac',
    description: 'Préparer le bac de maths',
    targetScore: 80,
    horizon: '6_MONTHS',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-07-01'),
    status: 'ACTIVE' as const,
    milestones: [
      { id: 'm1', title: 'Milestone 1', targetDate: '2026-03-01', completed: false, completedAt: null },
      { id: 'm2', title: 'Milestone 2', targetDate: '2026-05-01', completed: true, completedAt: '2026-04-15' },
    ],
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    studentId: 'student-1',
    createdBy: null,
  };

  describe('createTrajectory', () => {
    it('creates a trajectory with milestones', async () => {
      prisma.trajectory.create.mockResolvedValue(baseTraj);

      const result = await createTrajectory({
        studentId: 'student-1',
        title: 'Objectif Bac',
        description: 'Préparer le bac de maths',
        targetScore: 80,
        horizon: '6_MONTHS',
        milestones: [
          { id: 'm1', title: 'Milestone 1', targetDate: '2026-03-01' },
        ],
      });

      expect(prisma.trajectory.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('traj-1');
      expect(result.title).toBe('Objectif Bac');
      expect(result.progress).toBeDefined();
      expect(result.daysRemaining).toBeDefined();
    });

    it('creates a trajectory without milestones', async () => {
      const noMilestones = { ...baseTraj, milestones: [] };
      prisma.trajectory.create.mockResolvedValue(noMilestones);

      const result = await createTrajectory({
        studentId: 'student-1',
        title: 'Simple Goal',
        horizon: '3_MONTHS',
      });

      expect(result.progress).toBe(0);
      expect(result.milestones).toEqual([]);
    });

    it('throws for invalid horizon', async () => {
      await expect(
        createTrajectory({
          studentId: 'student-1',
          title: 'Bad',
          horizon: 'INVALID' as any,
        })
      ).rejects.toThrow('Invalid horizon');
    });
  });

  describe('getActiveTrajectory', () => {
    it('returns enriched trajectory when found', async () => {
      prisma.trajectory.findFirst.mockResolvedValue(baseTraj);

      const result = await getActiveTrajectory('student-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('traj-1');
      expect(result!.status).toBe('ACTIVE');
      expect(result!.progress).toBe(50); // 1 of 2 milestones completed
    });

    it('returns null when no active trajectory', async () => {
      prisma.trajectory.findFirst.mockResolvedValue(null);

      const result = await getActiveTrajectory('student-1');
      expect(result).toBeNull();
    });
  });

  describe('completeMilestone', () => {
    it('marks milestone as completed', async () => {
      prisma.trajectory.findUnique.mockResolvedValue(baseTraj);
      prisma.trajectory.update.mockResolvedValue({
        ...baseTraj,
        milestones: baseTraj.milestones.map(m =>
          m.id === 'm1' ? { ...m, completed: true, completedAt: new Date().toISOString() } : m
        ),
      });

      const result = await completeMilestone('traj-1', 'm1');
      expect(prisma.trajectory.update).toHaveBeenCalledTimes(1);
      expect(result.id).toBe('traj-1');
    });

    it('throws when trajectory not found', async () => {
      prisma.trajectory.findUnique.mockResolvedValue(null);

      await expect(completeMilestone('nonexistent', 'm1')).rejects.toThrow('Trajectory not found');
    });

    it('throws when milestone not found', async () => {
      prisma.trajectory.findUnique.mockResolvedValue(baseTraj);

      await expect(completeMilestone('traj-1', 'nonexistent')).rejects.toThrow('Milestone not found');
    });

    it('sets status to COMPLETED when all milestones done', async () => {
      const allDone = {
        ...baseTraj,
        milestones: [
          { id: 'm1', title: 'M1', targetDate: '2026-03-01', completed: true, completedAt: '2026-02-15' },
          { id: 'm2', title: 'M2', targetDate: '2026-05-01', completed: false, completedAt: null },
        ],
      };
      prisma.trajectory.findUnique.mockResolvedValue(allDone);
      prisma.trajectory.update.mockResolvedValue({
        ...allDone,
        status: 'COMPLETED',
        milestones: allDone.milestones.map(m =>
          m.id === 'm2' ? { ...m, completed: true, completedAt: new Date().toISOString() } : m
        ),
      });

      const result = await completeMilestone('traj-1', 'm2');
      const updateCall = prisma.trajectory.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('COMPLETED');
      expect(result).toBeDefined();
    });
  });

  describe('updateTrajectoryStatus', () => {
    it('updates status and returns enriched trajectory', async () => {
      prisma.trajectory.update.mockResolvedValue({
        ...baseTraj,
        status: 'PAUSED',
      });

      const result = await updateTrajectoryStatus('traj-1', 'PAUSED' as any);
      expect(prisma.trajectory.update).toHaveBeenCalledWith({
        where: { id: 'traj-1' },
        data: { status: 'PAUSED' },
      });
      expect(result.status).toBe('PAUSED');
    });
  });

  describe('enrichTrajectory (via public functions)', () => {
    it('computes progress as percentage of completed milestones', async () => {
      prisma.trajectory.findFirst.mockResolvedValue(baseTraj);
      const result = await getActiveTrajectory('student-1');
      // 1 of 2 milestones completed = 50%
      expect(result!.progress).toBe(50);
    });

    it('computes 0 progress when no milestones', async () => {
      prisma.trajectory.findFirst.mockResolvedValue({ ...baseTraj, milestones: [] });
      const result = await getActiveTrajectory('student-1');
      expect(result!.progress).toBe(0);
    });

    it('computes daysRemaining correctly', async () => {
      const futureEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      prisma.trajectory.findFirst.mockResolvedValue({ ...baseTraj, endDate: futureEnd });
      const result = await getActiveTrajectory('student-1');
      expect(result!.daysRemaining).toBeGreaterThan(28);
      expect(result!.daysRemaining).toBeLessThanOrEqual(31);
    });

    it('daysRemaining is 0 for past endDate', async () => {
      prisma.trajectory.findFirst.mockResolvedValue({
        ...baseTraj,
        endDate: new Date('2020-01-01'),
      });
      const result = await getActiveTrajectory('student-1');
      expect(result!.daysRemaining).toBe(0);
    });
  });
});
