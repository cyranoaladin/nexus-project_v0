/**
 * P1 #3 — IDOR bilans/generate
 *
 * Coach A must not be able to trigger generation or poll status
 * for a bilan belonging to coach B's student.
 */

jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((v: unknown) => v instanceof Response),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilan: { findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock('@/lib/bilan/generator', () => ({
  BilanGenerator: { generateAndSave: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/lib/security/ownership', () => ({
  buildBilanWriteWhere: jest.fn(),
  buildBilanReadWhere: jest.fn(),
}));

import { POST, GET } from '@/app/api/bilans/generate/route';
import { requireAnyRole } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { buildBilanWriteWhere, buildBilanReadWhere } from '@/lib/security/ownership';
import { NextRequest } from 'next/server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockBilanFindFirst = prisma.bilan.findFirst as jest.Mock;
const mockBilanUpdate = prisma.bilan.update as jest.Mock;
const mockWriteWhere = buildBilanWriteWhere as jest.Mock;
const mockReadWhere = buildBilanReadWhere as jest.Mock;

const COACH_A = { id: 'coach-a', role: 'COACH', email: 'a@test.tn' };
const BILAN_OF_COACH_B = 'bilan-coach-b-student';

describe('IDOR bilans/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAnyRole.mockResolvedValue({ user: COACH_A });
  });

  describe('POST /api/bilans/generate', () => {
    it('returns 404 (not 200) when coach A tries to generate bilan of coach B student', async () => {
      // buildBilanWriteWhere returns null for cross-coach access
      mockWriteWhere.mockReturnValue(null);

      const req = new NextRequest('http://localhost/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: BILAN_OF_COACH_B }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      // Must NOT leak error metadata beyond "not found"
      expect(json).not.toHaveProperty('data');
      expect(json.error).toBe('Bilan not found');
      // Prisma must NOT have been called (denied before query)
      expect(mockBilanFindFirst).not.toHaveBeenCalled();
    });

    it('returns 200 when coach generates their own bilan', async () => {
      mockWriteWhere.mockReturnValue({ id: 'my-bilan', coach: { userId: COACH_A.id } });
      mockBilanFindFirst.mockResolvedValue({
        id: 'my-bilan',
        status: 'PENDING',
        type: 'DIAGNOSTIC_PRE_STAGE',
        subject: 'MATHEMATIQUES',
        studentName: 'Jean',
        studentEmail: 'j@test.tn',
        studentPhone: null,
        sourceData: {},
        globalScore: 50,
        confidenceIndex: 70,
        ssn: null,
        uai: null,
        domainScores: null,
        sourceVersion: null,
      });
      mockBilanUpdate.mockResolvedValue({ id: 'my-bilan', status: 'GENERATING' });

      const req = new NextRequest('http://localhost/api/bilans/generate', {
        method: 'POST',
        body: JSON.stringify({ bilanId: 'my-bilan' }),
      });

      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockWriteWhere).toHaveBeenCalledWith('my-bilan', COACH_A);
    });
  });

  describe('GET /api/bilans/generate (status)', () => {
    it('returns 404 when coach A polls status of coach B bilan', async () => {
      mockReadWhere.mockReturnValue(null);

      const req = new NextRequest(
        `http://localhost/api/bilans/generate?bilanId=${BILAN_OF_COACH_B}`,
        { method: 'GET' }
      );

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(404);
      expect(json.success).toBe(false);
      // Must NOT leak status, errorCode, errorDetails
      expect(json).not.toHaveProperty('data');
      expect(mockBilanFindFirst).not.toHaveBeenCalled();
    });

    it('returns 200 with status for coach own bilan', async () => {
      mockReadWhere.mockReturnValue({ id: 'my-bilan', coach: { userId: COACH_A.id } });
      mockBilanFindFirst.mockResolvedValue({
        id: 'my-bilan',
        status: 'COMPLETED',
        progress: 100,
        studentMarkdown: '# Report',
        parentsMarkdown: null,
        nexusMarkdown: null,
        errorCode: null,
        errorDetails: null,
        engineVersion: 'v1',
        ragUsed: true,
        updatedAt: new Date(),
      });

      const req = new NextRequest(
        'http://localhost/api/bilans/generate?bilanId=my-bilan',
        { method: 'GET' }
      );

      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('COMPLETED');
    });
  });
});
