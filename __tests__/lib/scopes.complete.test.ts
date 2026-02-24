/**
 * Student Scope Resolution — Complete Test Suite
 *
 * Tests: resolveStudentScope, getParentChildren
 *
 * Covers: ELEVE self-scope, PARENT child-scope, ADMIN/ASSISTANTE any-scope,
 *         COACH denied, cross-scope prevention, edge cases
 *
 * Source: lib/scopes.ts
 */

import { resolveStudentScope, getParentChildren } from '@/lib/scopes';

let prisma: any;

beforeEach(async () => {
  const mod = await import('@/lib/prisma');
  prisma = (mod as any).prisma;
  jest.clearAllMocks();
});

// ─── ELEVE Scope ─────────────────────────────────────────────────────────────

describe('resolveStudentScope — ELEVE', () => {
  it('should resolve to own student record', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', userId: 'user-1' });

    const result = await resolveStudentScope({ id: 'user-1', role: 'ELEVE' });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('stu-1');
      expect(result.studentUserId).toBe('user-1');
    }
  });

  it('should deny if student profile not found', async () => {
    prisma.student.findUnique.mockResolvedValue(null);

    const result = await resolveStudentScope({ id: 'user-1', role: 'ELEVE' });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toContain('introuvable');
    }
  });

  it('should deny ELEVE requesting a different studentId', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', userId: 'user-1' });

    const result = await resolveStudentScope(
      { id: 'user-1', role: 'ELEVE' },
      { studentId: 'stu-OTHER' }
    );

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toContain('périmètre');
    }
  });

  it('should allow ELEVE requesting their own studentId explicitly', async () => {
    prisma.student.findUnique.mockResolvedValue({ id: 'stu-1', userId: 'user-1' });

    const result = await resolveStudentScope(
      { id: 'user-1', role: 'ELEVE' },
      { studentId: 'stu-1' }
    );

    expect(result.authorized).toBe(true);
  });
});

// ─── PARENT Scope ────────────────────────────────────────────────────────────

describe('resolveStudentScope — PARENT', () => {
  it('should resolve to first child when no studentId specified', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [
        { id: 'stu-child-1', userId: 'user-child-1' },
        { id: 'stu-child-2', userId: 'user-child-2' },
      ],
    });

    const result = await resolveStudentScope({ id: 'parent-1', role: 'PARENT' });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('stu-child-1');
    }
  });

  it('should resolve to specific child when studentId matches', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [
        { id: 'stu-child-1', userId: 'user-child-1' },
        { id: 'stu-child-2', userId: 'user-child-2' },
      ],
    });

    const result = await resolveStudentScope(
      { id: 'parent-1', role: 'PARENT' },
      { studentId: 'stu-child-2' }
    );

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('stu-child-2');
      expect(result.studentUserId).toBe('user-child-2');
    }
  });

  it('should deny PARENT requesting a child they do not own', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [{ id: 'stu-child-1', userId: 'user-child-1' }],
    });

    const result = await resolveStudentScope(
      { id: 'parent-1', role: 'PARENT' },
      { studentId: 'stu-NOT-MY-CHILD' }
    );

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toContain('périmètre');
    }
  });

  it('should deny PARENT with no children', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({ children: [] });

    const result = await resolveStudentScope({ id: 'parent-1', role: 'PARENT' });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toContain('enfant');
    }
  });

  it('should deny PARENT with no profile', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);

    const result = await resolveStudentScope({ id: 'parent-1', role: 'PARENT' });

    expect(result.authorized).toBe(false);
  });
});

// ─── ADMIN / ASSISTANTE Scope ────────────────────────────────────────────────

describe('resolveStudentScope — ADMIN / ASSISTANTE', () => {
  const adminRoles = ['ADMIN', 'ASSISTANTE'];

  adminRoles.forEach((role) => {
    describe(`Role: ${role}`, () => {
      it('should resolve to any student when studentId provided', async () => {
        prisma.student.findUnique.mockResolvedValue({ id: 'stu-any', userId: 'user-any' });

        const result = await resolveStudentScope(
          { id: `${role.toLowerCase()}-1`, role },
          { studentId: 'stu-any' }
        );

        expect(result.authorized).toBe(true);
        if (result.authorized) {
          expect(result.studentId).toBe('stu-any');
        }
      });

      it('should deny when no studentId provided', async () => {
        const result = await resolveStudentScope({ id: `${role.toLowerCase()}-1`, role });

        expect(result.authorized).toBe(false);
        if (!result.authorized) {
          expect(result.error).toContain('requis');
        }
      });

      it('should deny when student not found', async () => {
        prisma.student.findUnique.mockResolvedValue(null);

        const result = await resolveStudentScope(
          { id: `${role.toLowerCase()}-1`, role },
          { studentId: 'stu-nonexistent' }
        );

        expect(result.authorized).toBe(false);
        if (!result.authorized) {
          expect(result.error).toContain('introuvable');
        }
      });
    });
  });
});

// ─── Unsupported Roles ───────────────────────────────────────────────────────

describe('resolveStudentScope — Unsupported Roles', () => {
  it('should deny COACH', async () => {
    const result = await resolveStudentScope({ id: 'coach-1', role: 'COACH' });
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toContain('non autorisé');
    }
  });

  it('should deny unknown role', async () => {
    const result = await resolveStudentScope({ id: 'unknown-1', role: 'SUPERADMIN' });
    expect(result.authorized).toBe(false);
  });
});

// ─── getParentChildren ───────────────────────────────────────────────────────

describe('getParentChildren', () => {
  it('should return children for a parent', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [
        {
          id: 'stu-1',
          userId: 'user-1',
          user: { firstName: 'Mehdi', lastName: 'Ben Ali' },
          grade: 'Terminale',
        },
      ],
    });

    const children = await getParentChildren('parent-1');

    expect(children).toHaveLength(1);
    expect(children[0].firstName).toBe('Mehdi');
    expect(children[0].grade).toBe('Terminale');
  });

  it('should return empty array for non-parent', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue(null);

    const children = await getParentChildren('not-a-parent');

    expect(children).toEqual([]);
  });

  it('should handle null firstName/lastName', async () => {
    prisma.parentProfile.findUnique.mockResolvedValue({
      children: [
        {
          id: 'stu-1',
          userId: 'user-1',
          user: { firstName: null, lastName: null },
          grade: null,
        },
      ],
    });

    const children = await getParentChildren('parent-1');

    expect(children[0].firstName).toBe('');
    expect(children[0].lastName).toBe('');
    expect(children[0].grade).toBeNull();
  });
});
