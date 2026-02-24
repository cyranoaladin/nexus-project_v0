/**
 * Authentication & Authorization Guards — Complete Test Suite
 *
 * Tests: requireAuth, requireRole, requireAnyRole, isOwner, isStaff, isErrorResponse
 *
 * Source: lib/guards.ts
 */

import { requireAuth, requireRole, requireAnyRole, isOwner, isStaff, isErrorResponse, type AuthSession } from '@/lib/guards';
import { NextResponse } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: (...args: any[]) => mockAuth(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<AuthSession['user']> = {}): any {
  return {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'ADMIN',
      firstName: 'John',
      lastName: 'Doe',
      ...overrides,
    },
    expires: '2026-12-31T00:00:00Z',
  };
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('should return session when authenticated', async () => {
    mockAuth.mockResolvedValue(makeSession());

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(false);
    expect((result as AuthSession).user.id).toBe('user-1');
  });

  it('should return 401 when no session', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should return 401 when session has no user', async () => {
    mockAuth.mockResolvedValue({ user: null });

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should return 401 when user has no id', async () => {
    mockAuth.mockResolvedValue(makeSession({ id: '' }));

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should return 401 when user has no role', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: '' as any }));

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should return 401 when user has no email', async () => {
    mockAuth.mockResolvedValue(makeSession({ email: '' }));

    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });
});

// ─── requireRole ─────────────────────────────────────────────────────────────

describe('requireRole', () => {
  it('should return session when role matches', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ADMIN' }));

    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(false);
    expect((result as AuthSession).user.role).toBe('ADMIN');
  });

  it('should return 403 when role does not match', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ELEVE' }));

    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(403);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should include required role in error message', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ELEVE' }));

    const result = await requireRole('ADMIN' as any);
    const body = await (result as NextResponse).json();
    expect(body.message).toContain('ADMIN');
  });
});

// ─── requireAnyRole ──────────────────────────────────────────────────────────

describe('requireAnyRole', () => {
  it('should return session when role is in allowed list', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ASSISTANTE' }));

    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any[]);
    expect(isErrorResponse(result)).toBe(false);
  });

  it('should return 403 when role is not in allowed list', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ELEVE' }));

    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any[]);
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(403);
  });

  it('should return 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const result = await requireAnyRole(['ADMIN'] as any[]);
    expect(isErrorResponse(result)).toBe(true);
    expect((result as NextResponse).status).toBe(401);
  });

  it('should include allowed roles in error message', async () => {
    mockAuth.mockResolvedValue(makeSession({ role: 'ELEVE' }));

    const result = await requireAnyRole(['ADMIN', 'COACH'] as any[]);
    const body = await (result as NextResponse).json();
    expect(body.message).toContain('ADMIN');
    expect(body.message).toContain('COACH');
  });
});

// ─── isOwner ─────────────────────────────────────────────────────────────────

describe('isOwner', () => {
  const session: AuthSession = makeSession({ id: 'user-1' });

  it('should return true when user owns the resource', () => {
    expect(isOwner(session, 'user-1')).toBe(true);
  });

  it('should return false when user does not own the resource', () => {
    expect(isOwner(session, 'user-2')).toBe(false);
  });

  it('should return false for empty userId', () => {
    expect(isOwner(session, '')).toBe(false);
  });
});

// ─── isStaff ─────────────────────────────────────────────────────────────────

describe('isStaff', () => {
  it('should return true for ADMIN', () => {
    expect(isStaff(makeSession({ role: 'ADMIN' }))).toBe(true);
  });

  it('should return true for ASSISTANTE', () => {
    expect(isStaff(makeSession({ role: 'ASSISTANTE' }))).toBe(true);
  });

  it('should return false for ELEVE', () => {
    expect(isStaff(makeSession({ role: 'ELEVE' }))).toBe(false);
  });

  it('should return false for PARENT', () => {
    expect(isStaff(makeSession({ role: 'PARENT' }))).toBe(false);
  });

  it('should return false for COACH', () => {
    expect(isStaff(makeSession({ role: 'COACH' }))).toBe(false);
  });
});

// ─── isErrorResponse ─────────────────────────────────────────────────────────

describe('isErrorResponse', () => {
  it('should return true for NextResponse', () => {
    const response = NextResponse.json({ error: 'test' }, { status: 401 });
    expect(isErrorResponse(response)).toBe(true);
  });

  it('should return false for session object', () => {
    const session = makeSession();
    expect(isErrorResponse(session)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isErrorResponse(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isErrorResponse(undefined)).toBe(false);
  });
});
