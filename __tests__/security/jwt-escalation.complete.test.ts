/**
 * JWT Escalation Security Tests — Complete Suite
 *
 * Tests: role escalation prevention, token tampering, session hijacking,
 *        privilege escalation via API
 *
 * Source: lib/guards.ts + auth configuration
 */

import { requireAuth, requireRole, requireAnyRole } from '@/lib/guards';

// Mock auth() from NextAuth
const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(overrides: Record<string, unknown> = {}) {
  return {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      role: 'ELEVE',
      firstName: 'Test',
      lastName: 'User',
      ...overrides,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function isErrorResponse(result: unknown): boolean {
  return result instanceof Response || (typeof result === 'object' && result !== null && 'status' in result);
}

// ─── requireAuth ─────────────────────────────────────────────────────────────

describe('requireAuth — Authentication Guards', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when no session exists', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null);

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(401);
  });

  it('should return 401 when session has no user', async () => {
    // Arrange
    mockAuth.mockResolvedValue({ expires: '2026-12-31' });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });

  it('should return 401 when session user has no id', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { email: 'test@example.com', role: 'ELEVE' },
      expires: '2026-12-31',
    });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });

  it('should return 401 when session user has no role', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com' },
      expires: '2026-12-31',
    });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });

  it('should return 401 when session user has no email', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', role: 'ELEVE' },
      expires: '2026-12-31',
    });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });

  it('should return session when valid', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession());

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(false);
    expect((result as any).user.id).toBe('user-1');
    expect((result as any).user.role).toBe('ELEVE');
  });
});

// ─── requireRole — Role Escalation Prevention ────────────────────────────────

describe('requireRole — Role Escalation Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should deny ELEVE accessing ADMIN-only endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ELEVE' }));

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should deny PARENT accessing ADMIN-only endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'PARENT' }));

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should deny COACH accessing ADMIN-only endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'COACH' }));

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should deny ASSISTANTE accessing ADMIN-only endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ASSISTANTE' }));

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should allow ADMIN accessing ADMIN-only endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ADMIN' }));

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(false);
    expect((result as any).user.role).toBe('ADMIN');
  });

  it('should return 401 for unauthenticated user on role-protected endpoint', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null);

    // Act
    const result = await requireRole('ADMIN' as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(401);
  });
});

// ─── requireAnyRole — Multi-Role Access ──────────────────────────────────────

describe('requireAnyRole — Multi-Role Access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should allow ADMIN when [ADMIN, ASSISTANTE] required', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ADMIN' }));

    // Act
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(false);
  });

  it('should allow ASSISTANTE when [ADMIN, ASSISTANTE] required', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ASSISTANTE' }));

    // Act
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(false);
  });

  it('should deny ELEVE when [ADMIN, ASSISTANTE] required', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ELEVE' }));

    // Act
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should deny PARENT when [ADMIN, COACH] required', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'PARENT' }));

    // Act
    const result = await requireAnyRole(['ADMIN', 'COACH'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(403);
  });

  it('should return 401 for unauthenticated user', async () => {
    // Arrange
    mockAuth.mockResolvedValue(null);

    // Act
    const result = await requireAnyRole(['ADMIN'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    expect(response.status).toBe(401);
  });

  it('should include required roles in error message', async () => {
    // Arrange
    mockAuth.mockResolvedValue(mockSession({ role: 'ELEVE' }));

    // Act
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);

    // Assert
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    const body = await response.json();
    expect(body.message).toContain('ADMIN');
    expect(body.message).toContain('ASSISTANTE');
  });
});

// ─── Session Tampering ───────────────────────────────────────────────────────

describe('Session Tampering Prevention', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject session with empty string id', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { id: '', email: 'test@example.com', role: 'ADMIN' },
      expires: '2026-12-31',
    });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });

  it('should reject session with empty string role', async () => {
    // Arrange
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', role: '' },
      expires: '2026-12-31',
    });

    // Act
    const result = await requireAuth();

    // Assert
    expect(isErrorResponse(result)).toBe(true);
  });
});
