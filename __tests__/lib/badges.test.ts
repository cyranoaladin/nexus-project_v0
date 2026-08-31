jest.mock('@/lib/prisma', () => ({
  prisma: {
    badge: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    studentBadge: {
      findUnique: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    ariaMessage: {
      count: jest.fn(),
    },
    ariaFeedback: {
      count: jest.fn(),
    },
  },
}));

import { initializeBadges, awardBadge, checkAndAwardBadges, getStudentBadges } from '@/lib/badges';
import { prisma } from '@/lib/prisma';

describe('badges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes badges via upsert', async () => {
    await initializeBadges();
    expect(prisma.badge.upsert).toHaveBeenCalled();
  });

  it('awards badge when not yet earned', async () => {
    (prisma.badge.findUnique as jest.Mock).mockResolvedValue({ id: 'badge-1' });
    (prisma.studentBadge.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.studentBadge.create as jest.Mock).mockResolvedValue({ id: 'sb-1' });

    const result = await awardBadge('student-1', 'Premiers Pas');
    expect(result).toEqual({ id: 'sb-1' });
  });

  it('does not award badge if already earned', async () => {
    (prisma.badge.findUnique as jest.Mock).mockResolvedValue({ id: 'badge-1' });
    (prisma.studentBadge.findUnique as jest.Mock).mockResolvedValue({ id: 'sb-1' });

    const result = await awardBadge('student-1', 'Premiers Pas');
    expect(result).toBeNull();
  });

  it('checkAndAwardBadges handles aria feedback threshold', async () => {
    (prisma.badge.findUnique as jest.Mock).mockResolvedValue({ id: 'badge-2' });
    (prisma.studentBadge.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.studentBadge.create as jest.Mock).mockResolvedValue({ id: 'sb-2' });
    (prisma.ariaFeedback.count as jest.Mock).mockResolvedValue(10);

    const result = await checkAndAwardBadges('student-1', 'aria_feedback');
    expect(result.length).toBe(1);
    expect(prisma.ariaFeedback.count).toHaveBeenCalledWith({
      where: { studentId: 'student-1' },
    });
    expect(prisma.ariaMessage.count).not.toHaveBeenCalled();
  });

  it('getStudentBadges returns list', async () => {
    (prisma.studentBadge.findMany as jest.Mock).mockResolvedValue([{ id: 'sb-1' }]);
    const result = await getStudentBadges('student-1');
    expect(result).toEqual([{ id: 'sb-1' }]);
  });
});
