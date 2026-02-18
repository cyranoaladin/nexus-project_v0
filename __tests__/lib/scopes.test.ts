/**
 * Unit tests for resolveStudentScope — scope resolution logic.
 *
 * Mocks prisma to test authorization rules without DB.
 */

import { resolveStudentScope, getParentChildren, type SessionUser } from '@/lib/scopes';

// ─── Mock Prisma ─────────────────────────────────────────────────────────────

const mockStudentFindUnique = jest.fn();
const mockParentProfileFindUnique = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    parentProfile: { findUnique: (...args: unknown[]) => mockParentProfileFindUnique(...args) },
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── ELEVE ───────────────────────────────────────────────────────────────────

describe('resolveStudentScope — ELEVE', () => {
  const eleveUser: SessionUser = { id: 'user-eleve-1', role: 'ELEVE' };

  it('resolves to own student record', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', userId: 'user-eleve-1' });

    const result = await resolveStudentScope(eleveUser);

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('student-1');
      expect(result.studentUserId).toBe('user-eleve-1');
    }
  });

  it('returns error when student profile not found', async () => {
    mockStudentFindUnique.mockResolvedValue(null);

    const result = await resolveStudentScope(eleveUser);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Profil élève introuvable');
    }
  });

  it('denies access when requesting a different student', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', userId: 'user-eleve-1' });

    const result = await resolveStudentScope(eleveUser, { studentId: 'student-other' });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Accès restreint à votre périmètre');
    }
  });

  it('allows requesting own student ID explicitly', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', userId: 'user-eleve-1' });

    const result = await resolveStudentScope(eleveUser, { studentId: 'student-1' });

    expect(result.authorized).toBe(true);
  });
});

// ─── PARENT ──────────────────────────────────────────────────────────────────

describe('resolveStudentScope — PARENT', () => {
  const parentUser: SessionUser = { id: 'user-parent-1', role: 'PARENT' };

  it('resolves to first child when no studentId specified', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [
        { id: 'child-1', userId: 'user-child-1' },
        { id: 'child-2', userId: 'user-child-2' },
      ],
    });

    const result = await resolveStudentScope(parentUser);

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('child-1');
      expect(result.studentUserId).toBe('user-child-1');
    }
  });

  it('resolves to specific child when studentId matches', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [
        { id: 'child-1', userId: 'user-child-1' },
        { id: 'child-2', userId: 'user-child-2' },
      ],
    });

    const result = await resolveStudentScope(parentUser, { studentId: 'child-2' });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('child-2');
      expect(result.studentUserId).toBe('user-child-2');
    }
  });

  it('denies access when requesting a child that is not theirs', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [{ id: 'child-1', userId: 'user-child-1' }],
    });

    const result = await resolveStudentScope(parentUser, { studentId: 'child-other' });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Accès restreint à votre périmètre');
    }
  });

  it('returns error when parent has no children', async () => {
    mockParentProfileFindUnique.mockResolvedValue({ children: [] });

    const result = await resolveStudentScope(parentUser);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Aucun enfant associé à votre compte');
    }
  });

  it('returns error when parent profile not found', async () => {
    mockParentProfileFindUnique.mockResolvedValue(null);

    const result = await resolveStudentScope(parentUser);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Aucun enfant associé à votre compte');
    }
  });
});

// ─── ADMIN / ASSISTANTE ──────────────────────────────────────────────────────

describe('resolveStudentScope — ADMIN', () => {
  const adminUser: SessionUser = { id: 'user-admin-1', role: 'ADMIN' };

  it('resolves to any student when studentId is provided', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-any', userId: 'user-any' });

    const result = await resolveStudentScope(adminUser, { studentId: 'student-any' });

    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.studentId).toBe('student-any');
    }
  });

  it('returns error when no studentId specified', async () => {
    const result = await resolveStudentScope(adminUser);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Identifiant élève requis pour ce rôle');
    }
  });

  it('returns error when student not found', async () => {
    mockStudentFindUnique.mockResolvedValue(null);

    const result = await resolveStudentScope(adminUser, { studentId: 'nonexistent' });

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Élève introuvable');
    }
  });
});

describe('resolveStudentScope — ASSISTANTE', () => {
  const assistanteUser: SessionUser = { id: 'user-assist-1', role: 'ASSISTANTE' };

  it('resolves to any student when studentId is provided', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: 'student-x', userId: 'user-x' });

    const result = await resolveStudentScope(assistanteUser, { studentId: 'student-x' });

    expect(result.authorized).toBe(true);
  });

  it('returns error when no studentId specified', async () => {
    const result = await resolveStudentScope(assistanteUser);

    expect(result.authorized).toBe(false);
  });
});

// ─── COACH (unsupported) ─────────────────────────────────────────────────────

describe('resolveStudentScope — COACH', () => {
  const coachUser: SessionUser = { id: 'user-coach-1', role: 'COACH' };

  it('returns error for unsupported role', async () => {
    const result = await resolveStudentScope(coachUser);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.error).toBe('Rôle non autorisé pour cette ressource');
    }
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('resolveStudentScope — edge cases', () => {
  it('handles null studentId option', async () => {
    const eleveUser: SessionUser = { id: 'user-eleve-1', role: 'ELEVE' };
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', userId: 'user-eleve-1' });

    const result = await resolveStudentScope(eleveUser, { studentId: null });

    expect(result.authorized).toBe(true);
  });

  it('handles undefined studentId option', async () => {
    const eleveUser: SessionUser = { id: 'user-eleve-1', role: 'ELEVE' };
    mockStudentFindUnique.mockResolvedValue({ id: 'student-1', userId: 'user-eleve-1' });

    const result = await resolveStudentScope(eleveUser, { studentId: undefined });

    expect(result.authorized).toBe(true);
  });
});

// ─── getParentChildren ──────────────────────────────────────────────────────

describe('getParentChildren', () => {
  it('returns children for a parent user', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [
        { id: 'child-1', userId: 'user-child-1', user: { firstName: 'Karim', lastName: 'Ben Ali' }, grade: 'TERMINALE' },
        { id: 'child-2', userId: 'user-child-2', user: { firstName: 'Sara', lastName: 'Ben Ali' }, grade: 'PREMIERE' },
      ],
    });

    const result = await getParentChildren('user-parent-1');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'child-1',
      userId: 'user-child-1',
      firstName: 'Karim',
      lastName: 'Ben Ali',
      grade: 'TERMINALE',
    });
    expect(result[1].firstName).toBe('Sara');
  });

  it('returns empty array when parent profile not found', async () => {
    mockParentProfileFindUnique.mockResolvedValue(null);

    const result = await getParentChildren('nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array when parent has no children', async () => {
    mockParentProfileFindUnique.mockResolvedValue({ children: [] });

    const result = await getParentChildren('user-parent-1');
    expect(result).toEqual([]);
  });

  it('handles null firstName/lastName gracefully', async () => {
    mockParentProfileFindUnique.mockResolvedValue({
      children: [
        { id: 'child-1', userId: 'user-child-1', user: { firstName: null, lastName: null }, grade: null },
      ],
    });

    const result = await getParentChildren('user-parent-1');
    expect(result[0].firstName).toBe('');
    expect(result[0].lastName).toBe('');
    expect(result[0].grade).toBeNull();
  });
});
