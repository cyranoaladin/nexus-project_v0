/**
 * Trajectory Engine — Complete Test Suite
 *
 * Tests: parseMilestones, createTrajectory, getActiveTrajectory,
 *        completeMilestone, updateTrajectoryStatus
 *
 * Source: lib/trajectory.ts
 */

import {
  parseMilestones,
  createTrajectory,
  getActiveTrajectory,
  completeMilestone,
  updateTrajectoryStatus,
} from '@/lib/trajectory';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeTrajectoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'traj-1',
    title: 'Objectif Bac',
    description: 'Atteindre 80/100 au SSN',
    targetScore: 80,
    horizon: '6_MONTHS',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-07-01'),
    status: 'ACTIVE',
    milestones: [],
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

// ─── parseMilestones ─────────────────────────────────────────────────────────

describe('parseMilestones', () => {
  it('should return empty array for null', () => {
    expect(parseMilestones(null)).toEqual([]);
  });

  it('should return empty array for non-array', () => {
    expect(parseMilestones('not an array')).toEqual([]);
    expect(parseMilestones(42)).toEqual([]);
    expect(parseMilestones({})).toEqual([]);
  });

  it('should parse valid milestones', () => {
    const raw = [
      { id: 'm1', title: 'Milestone 1', targetDate: '2026-03-01', completed: false, completedAt: null },
      { id: 'm2', title: 'Milestone 2', targetDate: '2026-06-01', completed: true, completedAt: '2026-04-15' },
    ];
    const result = parseMilestones(raw);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('m1');
    expect(result[0].completed).toBe(false);
    expect(result[1].completed).toBe(true);
    expect(result[1].completedAt).toBe('2026-04-15');
  });

  it('should handle missing fields gracefully', () => {
    const raw = [{ id: 'm1' }];
    const result = parseMilestones(raw);
    expect(result[0].title).toBe('');
    expect(result[0].targetDate).toBe('');
    expect(result[0].completed).toBe(false);
    expect(result[0].completedAt).toBeNull();
  });

  it('should return empty array for empty array', () => {
    expect(parseMilestones([])).toEqual([]);
  });
});

// ─── createTrajectory ────────────────────────────────────────────────────────

describe('createTrajectory', () => {
  it('should create a trajectory with 6_MONTHS horizon', async () => {
    prisma.trajectory.create.mockResolvedValue(makeTrajectoryRow());

    const result = await createTrajectory({
      studentId: 'stu-1',
      title: 'Objectif Bac',
      horizon: '6_MONTHS',
    });

    expect(result.id).toBe('traj-1');
    expect(result.title).toBe('Objectif Bac');
    expect(result.progress).toBe(0);
    expect(prisma.trajectory.create).toHaveBeenCalledTimes(1);
  });

  it('should create a trajectory with milestones', async () => {
    const milestones = [
      { id: 'm1', title: 'Milestone 1', targetDate: '2026-03-01', completed: false, completedAt: null },
    ];
    prisma.trajectory.create.mockResolvedValue(makeTrajectoryRow({ milestones }));

    const result = await createTrajectory({
      studentId: 'stu-1',
      title: 'Test',
      horizon: '3_MONTHS',
      milestones: [{ id: 'm1', title: 'Milestone 1', targetDate: '2026-03-01' }],
    });

    expect(result.milestones).toHaveLength(1);
    expect(result.milestones[0].completed).toBe(false);
  });

  it('should throw for invalid horizon', async () => {
    await expect(
      createTrajectory({
        studentId: 'stu-1',
        title: 'Test',
        horizon: 'INVALID' as any,
      })
    ).rejects.toThrow('Invalid horizon');
  });

  it('should set description and targetScore when provided', async () => {
    prisma.trajectory.create.mockResolvedValue(makeTrajectoryRow());

    await createTrajectory({
      studentId: 'stu-1',
      title: 'Test',
      horizon: '12_MONTHS',
      description: 'Long term goal',
      targetScore: 90,
    });

    expect(prisma.trajectory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: 'Long term goal',
          targetScore: 90,
        }),
      })
    );
  });
});

// ─── getActiveTrajectory ─────────────────────────────────────────────────────

describe('getActiveTrajectory', () => {
  it('should return null when no active trajectory', async () => {
    prisma.trajectory.findFirst.mockResolvedValue(null);

    const result = await getActiveTrajectory('stu-1');
    expect(result).toBeNull();
  });

  it('should return enriched trajectory when found', async () => {
    prisma.trajectory.findFirst.mockResolvedValue(makeTrajectoryRow());

    const result = await getActiveTrajectory('stu-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('traj-1');
    expect(result!.progress).toBe(0);
    expect(typeof result!.daysRemaining).toBe('number');
  });

  it('should query with ACTIVE status', async () => {
    prisma.trajectory.findFirst.mockResolvedValue(null);

    await getActiveTrajectory('stu-1');

    expect(prisma.trajectory.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'stu-1', status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('should compute progress from milestones', async () => {
    const milestones = [
      { id: 'm1', title: 'A', targetDate: '2026-03-01', completed: true, completedAt: '2026-02-01' },
      { id: 'm2', title: 'B', targetDate: '2026-06-01', completed: false, completedAt: null },
    ];
    prisma.trajectory.findFirst.mockResolvedValue(makeTrajectoryRow({ milestones }));

    const result = await getActiveTrajectory('stu-1');

    expect(result!.progress).toBe(50); // 1/2 = 50%
  });
});

// ─── completeMilestone ───────────────────────────────────────────────────────

describe('completeMilestone', () => {
  it('should throw when trajectory not found', async () => {
    prisma.trajectory.findUnique.mockResolvedValue(null);

    await expect(completeMilestone('traj-x', 'm1')).rejects.toThrow('Trajectory not found');
  });

  it('should throw when milestone not found', async () => {
    prisma.trajectory.findUnique.mockResolvedValue(
      makeTrajectoryRow({
        milestones: [{ id: 'm1', title: 'A', targetDate: '2026-03-01', completed: false, completedAt: null }],
      })
    );

    await expect(completeMilestone('traj-1', 'm-nonexistent')).rejects.toThrow('Milestone not found');
  });

  it('should mark milestone as completed', async () => {
    const milestones = [
      { id: 'm1', title: 'A', targetDate: '2026-03-01', completed: false, completedAt: null },
      { id: 'm2', title: 'B', targetDate: '2026-06-01', completed: false, completedAt: null },
    ];
    prisma.trajectory.findUnique.mockResolvedValue(makeTrajectoryRow({ milestones }));
    prisma.trajectory.update.mockResolvedValue(
      makeTrajectoryRow({
        milestones: [
          { id: 'm1', title: 'A', targetDate: '2026-03-01', completed: true, completedAt: '2026-02-15' },
          { id: 'm2', title: 'B', targetDate: '2026-06-01', completed: false, completedAt: null },
        ],
      })
    );

    const result = await completeMilestone('traj-1', 'm1');

    expect(prisma.trajectory.update).toHaveBeenCalledTimes(1);
    expect(result.milestones[0].completed).toBe(true);
  });

  it('should set status to COMPLETED when all milestones done', async () => {
    const milestones = [
      { id: 'm1', title: 'A', targetDate: '2026-03-01', completed: true, completedAt: '2026-02-01' },
      { id: 'm2', title: 'B', targetDate: '2026-06-01', completed: false, completedAt: null },
    ];
    prisma.trajectory.findUnique.mockResolvedValue(makeTrajectoryRow({ milestones }));
    prisma.trajectory.update.mockResolvedValue(
      makeTrajectoryRow({ status: 'COMPLETED', milestones })
    );

    await completeMilestone('traj-1', 'm2');

    expect(prisma.trajectory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'COMPLETED',
        }),
      })
    );
  });
});

// ─── updateTrajectoryStatus ──────────────────────────────────────────────────

describe('updateTrajectoryStatus', () => {
  it('should update trajectory status', async () => {
    prisma.trajectory.update.mockResolvedValue(makeTrajectoryRow({ status: 'PAUSED' }));

    const result = await updateTrajectoryStatus('traj-1', 'PAUSED' as any);

    expect(result.status).toBe('PAUSED');
    expect(prisma.trajectory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'traj-1' },
        data: { status: 'PAUSED' },
      })
    );
  });

  it('should return enriched trajectory after update', async () => {
    prisma.trajectory.update.mockResolvedValue(makeTrajectoryRow({ status: 'COMPLETED' }));

    const result = await updateTrajectoryStatus('traj-1', 'COMPLETED' as any);

    expect(result.id).toBe('traj-1');
    expect(typeof result.progress).toBe('number');
    expect(typeof result.daysRemaining).toBe('number');
  });
});
