import { NextRequest } from 'next/server';

import { POST } from '@/app/api/eleve/bilan-diagnostic-maths-terminale/route';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/guards';

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((value) => value instanceof Response),
}));

function request(body: unknown) {
  return new NextRequest('http://localhost:3000/api/eleve/bilan-diagnostic-maths-terminale', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/eleve/bilan-diagnostic-maths-terminale — security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireRole as jest.Mock).mockResolvedValue({ user: { id: 'student-user-1', role: 'ELEVE' } });
  });

  it('rejects unexpected fields before DB access', async () => {
    const response = await POST(request({
      progress: {},
      qcmAnswers: {},
      openAnswers: {},
      step: 'progress',
      metadata: { rawPayload: true },
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid diagnostic payload');
    expect(prisma.student.findUnique).not.toHaveBeenCalled();
  });
});
