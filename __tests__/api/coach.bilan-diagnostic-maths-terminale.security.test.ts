jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((result) => result && typeof result === 'object' && 'status' in result),
}));

jest.mock('@/lib/rbac/coach-student-access', () => ({
  assertCoachCanAccessStudent: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    coachProfile: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/diagnostic/maths-terminale/scoring', () => ({
  computeDiagnostics: jest.fn(),
}));

jest.mock('@/lib/diagnostic/maths-terminale/data', () => ({
  DOMAINS: [],
}));

jest.mock('@/lib/utils/serialize-error', () => ({
  serializeError: jest.fn(() => ({ name: 'Error', message: 'redacted' })),
}));

import {
  GET,
  PATCH,
} from '@/app/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale/route';
import { requireRole } from '@/lib/guards';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma } from '@/lib/prisma';

describe('/api/coach/students/[studentId]/bilan-diagnostic-maths-terminale', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'coach-user-1', role: 'COACH' } });
  });

  it('rejects unsafe student ids on GET before checking assignment', async () => {
    const res = await GET(new Request('http://localhost/'), {
      params: Promise.resolve({ studentId: '../student' }),
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(assertCoachCanAccessStudent).not.toHaveBeenCalled();
    expect(prisma.bilan.findFirst).not.toHaveBeenCalled();
  });

  it('rejects unsafe student ids on PATCH before parsing body or mutating', async () => {
    const res = await PATCH(
      new Request('http://localhost/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherGrades: {} }),
      }),
      { params: Promise.resolve({ studentId: '../student' }) }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Données');
    expect(assertCoachCanAccessStudent).not.toHaveBeenCalled();
    expect(prisma.bilan.update).not.toHaveBeenCalled();
  });
});
