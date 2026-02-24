/**
 * Badges — Complete Test Suite
 *
 * Tests: initializeBadges, awardBadge, checkAndAwardBadges, getStudentBadges
 *
 * Source: lib/badges.ts
 */

import {
  initializeBadges,
  awardBadge,
  checkAndAwardBadges,
  getStudentBadges,
} from '@/lib/badges';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── initializeBadges ────────────────────────────────────────────────────────

describe('initializeBadges', () => {
  it('should upsert all badge definitions', async () => {
    prisma.badge.upsert.mockResolvedValue({});

    await initializeBadges();

    // Should have called upsert for each badge (15 badges defined)
    expect(prisma.badge.upsert).toHaveBeenCalled();
    expect(prisma.badge.upsert.mock.calls.length).toBeGreaterThanOrEqual(15);
  });

  it('should include badge name in where clause', async () => {
    prisma.badge.upsert.mockResolvedValue({});

    await initializeBadges();

    const firstCall = prisma.badge.upsert.mock.calls[0][0];
    expect(firstCall.where).toHaveProperty('name');
    expect(firstCall.create).toHaveProperty('name');
    expect(firstCall.update).toHaveProperty('name');
  });
});

// ─── awardBadge ──────────────────────────────────────────────────────────────

describe('awardBadge', () => {
  it('should return null when badge not found', async () => {
    prisma.badge.findUnique.mockResolvedValue(null);

    const result = await awardBadge('stu-1', 'Nonexistent Badge');
    expect(result).toBeNull();
  });

  it('should return null when student already has the badge', async () => {
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-1', name: 'Premiers Pas' });
    prisma.studentBadge.findUnique.mockResolvedValue({ id: 'sb-1' });

    const result = await awardBadge('stu-1', 'Premiers Pas');
    expect(result).toBeNull();
    expect(prisma.studentBadge.create).not.toHaveBeenCalled();
  });

  it('should create studentBadge when badge exists and not already awarded', async () => {
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-1', name: 'Premiers Pas' });
    prisma.studentBadge.findUnique.mockResolvedValue(null);
    prisma.studentBadge.create.mockResolvedValue({
      id: 'sb-new',
      studentId: 'stu-1',
      badgeId: 'badge-1',
      badge: { id: 'badge-1', name: 'Premiers Pas', icon: '👋' },
    });

    const result = await awardBadge('stu-1', 'Premiers Pas');

    expect(result).not.toBeNull();
    expect(result!.badge.name).toBe('Premiers Pas');
    expect(prisma.studentBadge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { studentId: 'stu-1', badgeId: 'badge-1' },
        include: { badge: true },
      })
    );
  });
});

// ─── checkAndAwardBadges ─────────────────────────────────────────────────────

describe('checkAndAwardBadges', () => {
  it('should award "Premiers Pas" on first_login event', async () => {
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-1', name: 'Premiers Pas' });
    prisma.studentBadge.findUnique.mockResolvedValue(null);
    prisma.studentBadge.create.mockResolvedValue({
      id: 'sb-1',
      badge: { name: 'Premiers Pas' },
    });

    const result = await checkAndAwardBadges('stu-1', 'first_login');

    expect(result).toHaveLength(1);
    expect(result[0].badge.name).toBe('Premiers Pas');
  });

  it('should award "Dialogue avec le Futur" on first_aria_question event', async () => {
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-2', name: 'Dialogue avec le Futur' });
    prisma.studentBadge.findUnique.mockResolvedValue(null);
    prisma.studentBadge.create.mockResolvedValue({
      id: 'sb-2',
      badge: { name: 'Dialogue avec le Futur' },
    });

    const result = await checkAndAwardBadges('stu-1', 'first_aria_question');

    expect(result).toHaveLength(1);
    expect(result[0].badge.name).toBe('Dialogue avec le Futur');
  });

  it('should award "Architecte du Feedback" when feedback count >= 10', async () => {
    prisma.ariaMessage.count.mockResolvedValue(10);
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-3', name: 'Architecte du Feedback' });
    prisma.studentBadge.findUnique.mockResolvedValue(null);
    prisma.studentBadge.create.mockResolvedValue({
      id: 'sb-3',
      badge: { name: 'Architecte du Feedback' },
    });

    const result = await checkAndAwardBadges('stu-1', 'aria_feedback');

    expect(result).toHaveLength(1);
  });

  it('should not award "Architecte du Feedback" when feedback count < 10', async () => {
    prisma.ariaMessage.count.mockResolvedValue(5);

    const result = await checkAndAwardBadges('stu-1', 'aria_feedback');

    expect(result).toHaveLength(0);
  });

  it('should award "Esprit Vif" when question count >= 25', async () => {
    prisma.ariaMessage.count.mockResolvedValue(25);
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-4', name: 'Esprit Vif' });
    prisma.studentBadge.findUnique.mockResolvedValue(null);
    prisma.studentBadge.create.mockResolvedValue({
      id: 'sb-4',
      badge: { name: 'Esprit Vif' },
    });

    const result = await checkAndAwardBadges('stu-1', 'aria_question_count');

    expect(result).toHaveLength(1);
  });

  it('should not award "Esprit Vif" when question count < 25', async () => {
    prisma.ariaMessage.count.mockResolvedValue(10);

    const result = await checkAndAwardBadges('stu-1', 'aria_question_count');

    expect(result).toHaveLength(0);
  });

  it('should return empty array for unknown event', async () => {
    const result = await checkAndAwardBadges('stu-1', 'unknown_event');
    expect(result).toHaveLength(0);
  });

  it('should return empty array when badge already awarded (first_login)', async () => {
    prisma.badge.findUnique.mockResolvedValue({ id: 'badge-1', name: 'Premiers Pas' });
    prisma.studentBadge.findUnique.mockResolvedValue({ id: 'existing' });

    const result = await checkAndAwardBadges('stu-1', 'first_login');

    expect(result).toHaveLength(0);
  });
});

// ─── getStudentBadges ────────────────────────────────────────────────────────

describe('getStudentBadges', () => {
  it('should return badges for a student', async () => {
    const mockBadges = [
      { id: 'sb-1', badge: { name: 'Premiers Pas', icon: '👋' }, earnedAt: new Date() },
      { id: 'sb-2', badge: { name: 'Esprit Vif', icon: '⚡' }, earnedAt: new Date() },
    ];
    prisma.studentBadge.findMany.mockResolvedValue(mockBadges);

    const result = await getStudentBadges('stu-1');

    expect(result).toHaveLength(2);
    expect(prisma.studentBadge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 'stu-1' },
        include: { badge: true },
        orderBy: { earnedAt: 'desc' },
      })
    );
  });

  it('should return empty array when student has no badges', async () => {
    prisma.studentBadge.findMany.mockResolvedValue([]);

    const result = await getStudentBadges('stu-1');

    expect(result).toHaveLength(0);
  });
});
