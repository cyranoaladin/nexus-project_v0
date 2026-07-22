/**
 * @jest-environment node
 *
 * Tests for GET /api/student/resources/official/[slug]
 * 11 cases: auth, slug validation, track/level gating, filesystem errors, happy path
 */

// 1. Mocks au top — JAMAIS dans beforeEach
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
}));

jest.mock('node:fs/promises', () => jest.requireMock('fs/promises'));

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/programme/official-pdfs', () => ({
  getRegisteredSlugs: jest.fn(),
  getOfficialPdf: jest.fn(),
  listOfficialPdfsForProfile: jest.fn(),
  OFFICIAL_PDFS: {},
}));

jest.mock('@/lib/utils/serialize-error', () => ({
  serializeError: jest.fn(() => ({ message: 'redacted' })),
}));

// Note: isOfficialPdfAllowedFor is NOT mocked — we test the real access logic

// 2. Imports after mocks
import { requireRole, isErrorResponse } from '@/lib/guards';
import { prisma } from '@/lib/prisma';
import { getRegisteredSlugs, getOfficialPdf } from '@/lib/programme/official-pdfs';
import { GET } from '@/app/api/student/resources/official/[slug]/route';
import { NextRequest, NextResponse } from 'next/server';
import { UserRole, GradeLevel, AcademicTrack } from '@prisma/client';
import type { OfficialPdfMetadata } from '@/lib/programme/official-pdfs';
import { serializeError } from '@/lib/utils/serialize-error';
import { readFile, stat } from 'fs/promises';
import { resolveOfficialPdfRelativePath } from '@/lib/programme/official-pdf-path';
import { join } from 'path';

// 3. Mock references
const mockRequireRole = jest.mocked(requireRole);
const mockIsErrorResponse = jest.mocked(isErrorResponse);
const mockStudentFind = jest.mocked(prisma.student.findUnique);
const mockGetSlugs = jest.mocked(getRegisteredSlugs);
const mockGetPdf = jest.mocked(getOfficialPdf);
const mockStat = stat as jest.Mock;
const mockReadFile = readFile as jest.Mock;
const mockSerializeError = jest.mocked(serializeError);

// 4. Fixtures — real slugs from Lot B mapping
const edsAutoSlug = 'bo-annexe-automatismes-eam-2025-2026-session-2027';
const declicSlug = 'declic-1s-2026-sujets';

const fakePdfBuffer = Buffer.from('%PDF-1.4 fake content');

const edsAutoMeta: OfficialPdfMetadata = {
  slug: edsAutoSlug,
  filename: 'bo-annexe-automatismes-eam-2025-2026-session-2027.pdf',
  baseDir: 'programmes/automatismes-eds-premiere',
  title: 'Annexe automatismes Epreuve anterieure de mathematiques',
  category: 'AUTOMATISMES',
  level: 'PREMIERE',
  track: 'EDS_GENERALE',
  source: 'MEN',
};

// Create a BOTH track meta for testing universal access
const bothTrackMeta: OfficialPdfMetadata = {
  slug: 'universal-programme-premiere',
  filename: 'universal-programme.pdf',
  baseDir: 'programmes',
  title: 'Programme universel Première',
  category: 'PROGRAM',
  level: 'PREMIERE',
  track: 'BOTH',
  source: 'MEN',
};

// Helpers
const buildSession = (userId: string) => ({
  user: {
    id: userId,
    email: 'eleve@test.com',
    role: UserRole.ELEVE,
  },
  expires: '2025-01-01T00:00:00.000Z',
});

const buildReq = (slug: string) =>
  new NextRequest(`http://localhost/api/student/resources/official/${slug}`);

const buildCtx = (slug: string) => ({ params: Promise.resolve({ slug }) });

// Suppress console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('GET /api/student/resources/official/[slug]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSlugs.mockReturnValue(new Set([edsAutoSlug, declicSlug, bothTrackMeta.slug]));
    mockStat.mockResolvedValue({ size: fakePdfBuffer.length } as never);
    mockReadFile.mockResolvedValue(fakePdfBuffer as never);
  });

  describe('Authentication', () => {
    it('returns 401 when not authenticated', async () => {
      const mockResponse = new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
      mockRequireRole.mockResolvedValue(mockResponse);
      mockIsErrorResponse.mockReturnValue(true);

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(401);
    });

    it('returns 403 when authenticated but not ELEVE', async () => {
      const mockResponse = new NextResponse(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
      mockRequireRole.mockResolvedValue(mockResponse);
      mockIsErrorResponse.mockReturnValue(true);

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(403);
    });
  });

  describe('Slug validation', () => {
    it('rejects path traversal slugs with 404', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-1'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.EDS_GENERALE,
      } as any);
      const traversalSlug = '../../../etc/passwd';

      const res = await GET(buildReq(traversalSlug), buildCtx(traversalSlug));

      expect(res.status).toBe(404);
    });

    it('returns 404 when slug is not in whitelist', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-1'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.EDS_GENERALE,
      } as any);
      const unknownSlug = 'inexistant-slug';

      const res = await GET(buildReq(unknownSlug), buildCtx(unknownSlug));

      expect(res.status).toBe(404);
    });
  });

  describe('Track/Level gating', () => {
    it('returns 403 when STMG student requests EDS automatismes PDF', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-stmg'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.STMG,
      } as any);
      mockGetPdf.mockReturnValue(edsAutoMeta);

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(403);
    });

    it('returns 403 when Terminale EDS student requests Premiere EDS automatismes PDF', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-tle'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.TERMINALE,
        academicTrack: AcademicTrack.EDS_GENERALE,
      } as any);
      mockGetPdf.mockReturnValue(edsAutoMeta);

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(403);
    });

    it('allows STMG student to access track BOTH PDF', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-stmg'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.STMG,
      } as any);
      mockGetPdf.mockReturnValue(bothTrackMeta);

      const res = await GET(buildReq(bothTrackMeta.slug), buildCtx(bothTrackMeta.slug));

      expect(res.status).not.toBe(403);
    });
  });

  describe('Filesystem behavior (mocked)', () => {
    const setupValidEdsRequest = () => {
      mockRequireRole.mockResolvedValue(buildSession('user-eds'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.EDS_GENERALE,
      } as any);
      mockGetPdf.mockReturnValue(edsAutoMeta);
    };

    it('returns 404 when the PDF file is missing on disk', async () => {
      setupValidEdsRequest();
      mockStat.mockRejectedValueOnce(new Error('missing'));

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(404);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 500 when reading the PDF fails unexpectedly', async () => {
      // This test verifies the outer catch block handles unexpected errors after
      // the file exists
      setupValidEdsRequest();
      mockReadFile.mockRejectedValueOnce(new Error('read failure'));

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(res.status).toBe(500);
      expect(mockSerializeError).toHaveBeenCalled();
    });

    it('rejects invalid PDF metadata before filesystem access', async () => {
      setupValidEdsRequest();
      mockGetPdf.mockReturnValue({
        ...edsAutoMeta,
        baseDir: 'programmes/../secrets',
      });

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body).toEqual({ error: 'Internal server error' });
      expect(JSON.stringify(body)).not.toContain(process.cwd());
      expect(mockSerializeError).toHaveBeenCalled();
      expect(mockStat).not.toHaveBeenCalled();
      expect(mockReadFile).not.toHaveBeenCalled();
    });
  });

  describe('Happy path', () => {
    it('verifies correct function calls for EDS Première student', async () => {
      mockRequireRole.mockResolvedValue(buildSession('user-eds'));
      mockIsErrorResponse.mockReturnValue(false);
      mockStudentFind.mockResolvedValue({
        gradeLevel: GradeLevel.PREMIERE,
        academicTrack: AcademicTrack.EDS_GENERALE,
      } as any);
      mockGetPdf.mockReturnValue(edsAutoMeta);

      const res = await GET(buildReq(edsAutoSlug), buildCtx(edsAutoSlug));

      expect(mockRequireRole).toHaveBeenCalledWith('ELEVE');
      expect(mockStudentFind).toHaveBeenCalledWith({
        where: { userId: 'user-eds' },
        select: { gradeLevel: true, academicTrack: true },
      });
      expect(mockGetSlugs).toHaveBeenCalled();
      expect(mockGetPdf).toHaveBeenCalledWith(edsAutoSlug);
      const expectedPath = join(
        process.cwd(),
        'programmes',
        resolveOfficialPdfRelativePath(edsAutoMeta)
      );

      expect(mockStat).toHaveBeenCalledWith(expectedPath);
      expect(mockReadFile).toHaveBeenCalledWith(expectedPath);
      expect(res.status).toBe(200);

      await res.arrayBuffer();
    });
  });
});
