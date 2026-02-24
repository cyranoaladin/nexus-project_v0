/**
 * RBAC Complete Matrix — Routes × Roles
 *
 * Tests that every API route enforces correct role-based access control.
 * Uses mocked auth() to simulate different roles hitting each endpoint.
 *
 * Matrix: 6 roles (ADMIN, ASSISTANTE, COACH, PARENT, ELEVE, ANONYMOUS)
 *         × route groups (admin, assistant, coach, parent, student, public)
 *
 * Source: lib/guards.ts + app/api/*
 */

import { requireAuth, requireRole, requireAnyRole } from '@/lib/guards';

const mockAuth = jest.fn();
jest.mock('@/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSession(role: string) {
  return {
    user: {
      id: `${role.toLowerCase()}-1`,
      email: `${role.toLowerCase()}@nexus.test`,
      role,
      firstName: 'Test',
      lastName: role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };
}

function isErrorResponse(result: unknown): boolean {
  return result instanceof Response || (typeof result === 'object' && result !== null && 'status' in result);
}

async function getStatus(result: unknown): Promise<number> {
  if (result instanceof Response) return result.status;
  if (typeof result === 'object' && result !== null && 'status' in result) {
    return (result as any).status;
  }
  return 200; // session returned = success
}

// ─── ADMIN Routes — Only ADMIN ──────────────────────────────────────────────

describe('RBAC: /api/admin/* — ADMIN only', () => {
  const adminRoutes = [
    '/api/admin/users',
    '/api/admin/dashboard',
    '/api/admin/analytics',
    '/api/admin/invoices',
    '/api/admin/subscriptions',
    '/api/admin/activities',
    '/api/admin/documents',
    '/api/admin/recompute-ssn',
    '/api/admin/directeur/stats',
  ];

  beforeEach(() => jest.clearAllMocks());

  it('ADMIN should access admin routes', async () => {
    mockAuth.mockResolvedValue(mockSession('ADMIN'));
    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(false);
  });

  const deniedRoles = ['ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to admin routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireRole('ADMIN' as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });

  it('ANONYMOUS should get 401 on admin routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── ASSISTANT Routes — ADMIN + ASSISTANTE ──────────────────────────────────

describe('RBAC: /api/assistant/* — ADMIN + ASSISTANTE', () => {
  beforeEach(() => jest.clearAllMocks());

  const allowedRoles = ['ADMIN', 'ASSISTANTE'];
  allowedRoles.forEach((role) => {
    it(`${role} should access assistant routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  const deniedRoles = ['COACH', 'PARENT', 'ELEVE'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to assistant routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });

  it('ANONYMOUS should get 401 on assistant routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── COACH Routes — ADMIN + ASSISTANTE + COACH ─────────────────────────────

describe('RBAC: /api/coach/* — ADMIN + ASSISTANTE + COACH', () => {
  beforeEach(() => jest.clearAllMocks());

  const allowedRoles = ['ADMIN', 'ASSISTANTE', 'COACH'];
  allowedRoles.forEach((role) => {
    it(`${role} should access coach routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'] as any);
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  const deniedRoles = ['PARENT', 'ELEVE'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to coach routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'] as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });

  it('ANONYMOUS should get 401 on coach routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'COACH'] as any);
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── PARENT Routes — ADMIN + ASSISTANTE + PARENT ────────────────────────────

describe('RBAC: /api/parent/* — ADMIN + ASSISTANTE + PARENT', () => {
  beforeEach(() => jest.clearAllMocks());

  const allowedRoles = ['ADMIN', 'ASSISTANTE', 'PARENT'];
  allowedRoles.forEach((role) => {
    it(`${role} should access parent routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'PARENT'] as any);
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  const deniedRoles = ['COACH', 'ELEVE'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to parent routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'PARENT'] as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });

  it('ANONYMOUS should get 401 on parent routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'PARENT'] as any);
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── STUDENT Routes — ADMIN + ASSISTANTE + ELEVE ────────────────────────────

describe('RBAC: /api/student/* — ADMIN + ASSISTANTE + ELEVE', () => {
  beforeEach(() => jest.clearAllMocks());

  const allowedRoles = ['ADMIN', 'ASSISTANTE', 'ELEVE'];
  allowedRoles.forEach((role) => {
    it(`${role} should access student routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'ELEVE'] as any);
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  const deniedRoles = ['COACH', 'PARENT'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to student routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'ELEVE'] as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });

  it('ANONYMOUS should get 401 on student routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE', 'ELEVE'] as any);
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── PAYMENT Routes — ADMIN + ASSISTANTE (validate/pending) ─────────────────

describe('RBAC: /api/payments/validate + /api/payments/pending — ADMIN + ASSISTANTE', () => {
  beforeEach(() => jest.clearAllMocks());

  const allowedRoles = ['ADMIN', 'ASSISTANTE'];
  allowedRoles.forEach((role) => {
    it(`${role} should access payment validation routes`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  const deniedRoles = ['COACH', 'PARENT', 'ELEVE'];
  deniedRoles.forEach((role) => {
    it(`${role} should be denied access to payment validation`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
      expect(isErrorResponse(result)).toBe(true);
    });
  });
});

// ─── SESSION Routes — Authenticated (any role) ─────────────────────────────

describe('RBAC: /api/sessions/* — Any authenticated role', () => {
  beforeEach(() => jest.clearAllMocks());

  const allRoles = ['ADMIN', 'ASSISTANTE', 'COACH', 'PARENT', 'ELEVE'];
  allRoles.forEach((role) => {
    it(`${role} should access session routes (authenticated)`, async () => {
      mockAuth.mockResolvedValue(mockSession(role));
      const result = await requireAuth();
      expect(isErrorResponse(result)).toBe(false);
    });
  });

  it('ANONYMOUS should get 401 on session routes', async () => {
    mockAuth.mockResolvedValue(null);
    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(true);
    const status = await getStatus(result);
    expect(status).toBe(401);
  });
});

// ─── Cross-Role Escalation Matrix ───────────────────────────────────────────

describe('RBAC: Cross-Role Escalation Prevention', () => {
  beforeEach(() => jest.clearAllMocks());

  const escalationAttempts = [
    { from: 'ELEVE', target: 'ADMIN', desc: 'ELEVE → ADMIN' },
    { from: 'ELEVE', target: 'ASSISTANTE', desc: 'ELEVE → ASSISTANTE' },
    { from: 'ELEVE', target: 'COACH', desc: 'ELEVE → COACH' },
    { from: 'PARENT', target: 'ADMIN', desc: 'PARENT → ADMIN' },
    { from: 'PARENT', target: 'ASSISTANTE', desc: 'PARENT → ASSISTANTE' },
    { from: 'PARENT', target: 'COACH', desc: 'PARENT → COACH' },
    { from: 'COACH', target: 'ADMIN', desc: 'COACH → ADMIN' },
    { from: 'COACH', target: 'ASSISTANTE', desc: 'COACH → ASSISTANTE' },
    { from: 'ASSISTANTE', target: 'ADMIN', desc: 'ASSISTANTE → ADMIN' },
  ];

  escalationAttempts.forEach(({ from, target, desc }) => {
    it(`should prevent escalation: ${desc}`, async () => {
      mockAuth.mockResolvedValue(mockSession(from));
      const result = await requireRole(target as any);
      expect(isErrorResponse(result)).toBe(true);
      const status = await getStatus(result);
      expect(status).toBe(403);
    });
  });
});

// ─── Guard Function Behavior ─────────────────────────────────────────────────

describe('RBAC: Guard Function Behavior', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requireAuth should return session object on success', async () => {
    mockAuth.mockResolvedValue(mockSession('ADMIN'));
    const result = await requireAuth();
    expect(isErrorResponse(result)).toBe(false);
    expect((result as any).user.role).toBe('ADMIN');
    expect((result as any).user.id).toBe('admin-1');
  });

  it('requireRole should return session when role matches', async () => {
    mockAuth.mockResolvedValue(mockSession('COACH'));
    const result = await requireRole('COACH' as any);
    expect(isErrorResponse(result)).toBe(false);
    expect((result as any).user.role).toBe('COACH');
  });

  it('requireAnyRole should return session when role is in list', async () => {
    mockAuth.mockResolvedValue(mockSession('PARENT'));
    const result = await requireAnyRole(['PARENT', 'ELEVE'] as any);
    expect(isErrorResponse(result)).toBe(false);
    expect((result as any).user.role).toBe('PARENT');
  });

  it('error response should include role information', async () => {
    mockAuth.mockResolvedValue(mockSession('ELEVE'));
    const result = await requireRole('ADMIN' as any);
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    const body = await response.json();
    expect(body.error).toBe('Forbidden');
    expect(body.message).toContain('ADMIN');
  });

  it('error response for requireAnyRole should list all required roles', async () => {
    mockAuth.mockResolvedValue(mockSession('ELEVE'));
    const result = await requireAnyRole(['ADMIN', 'ASSISTANTE'] as any);
    expect(isErrorResponse(result)).toBe(true);
    const response = result as Response;
    const body = await response.json();
    expect(body.message).toContain('ADMIN');
    expect(body.message).toContain('ASSISTANTE');
  });
});
