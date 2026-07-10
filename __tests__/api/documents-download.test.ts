/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/auth');
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userDocument: { findUnique: jest.fn() },
    parentProfile: { findUnique: jest.fn() },
  },
}));
jest.mock('@/lib/rbac/coach-student-access', () => ({
  assertCoachCanAccessStudent: jest.fn(),
}));
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  stat: jest.fn(),
  realpath: jest.fn(),
}));
jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  stat: jest.fn(),
  realpath: jest.fn(),
}));

import { GET } from '@/app/api/documents/[id]/download/route';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { readFile, stat, realpath } from 'fs/promises';

const mockAuth = auth as jest.Mock;
const mockStat = stat as jest.Mock;
const mockRealpath = realpath as jest.Mock;
const mockFindUnique = prisma.userDocument.findUnique as jest.Mock;
const mockParentFind = (prisma.parentProfile as unknown as { findUnique: jest.Mock }).findUnique;
const mockAssert = assertCoachCanAccessStudent as jest.Mock;
const mockReadFile = readFile as jest.Mock;

// ── Test data ────────────────────────────────────────────────────────────────

const DOC_ID = 'doc-abc123';
const COACH_USER_ID = 'coach-user-1';
const OTHER_COACH_USER_ID = 'coach-user-2';
const STUDENT_USER_ID = 'student-user-1';
const STUDENT_PROFILE_ID = 'student-profile-1';
const PARENT_PROFILE_ID = 'parent-profile-1';
const PARENT_USER_ID = 'parent-user-1';

const mockDocument = {
  id: DOC_ID,
  userId: STUDENT_USER_ID,
  localPath: '/app/storage/documents/student-user-1/test-doc.pdf',
  mimeType: 'application/pdf',
  originalName: 'test-doc.pdf',
  sizeBytes: 2048,
  visibilityScope: 'STUDENT_AND_COACH',
  user: {
    id: STUDENT_USER_ID,
    student: { id: STUDENT_PROFILE_ID, parentId: PARENT_PROFILE_ID },
  },
};

function request() {
  return new NextRequest(`http://localhost/api/documents/${DOC_ID}/download`, { method: 'GET' });
}

function params() {
  return { params: Promise.resolve({ id: DOC_ID }) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/documents/[id]/download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadFile.mockResolvedValue(Buffer.from('PDF content'));
    mockStat.mockResolvedValue({ size: 1024 });
    // realpath: returns the resolved path as-is (no symlinks in test env)
    mockRealpath.mockImplementation(async (p: string) => p);
  });

  it('returns 200 for assigned coach with correct visibilityScope', async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH_USER_ID, role: 'COACH' } });
    mockFindUnique.mockResolvedValue(mockDocument);
    mockAssert.mockResolvedValue(undefined); // assigned

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(mockAssert).toHaveBeenCalledWith({
      coachUserId: COACH_USER_ID,
      studentId: STUDENT_PROFILE_ID,
    });
  });

  it('returns 404 for non-assigned coach', async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_COACH_USER_ID, role: 'COACH' } });
    mockFindUnique.mockResolvedValue(mockDocument);
    mockAssert.mockRejectedValue(new Error('Not assigned'));

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 401 for anonymous user', async () => {
    mockAuth.mockResolvedValue(null);

    const res = await GET(request(), params());

    expect(res.status).toBe(401);
  });

  it('returns 200 for staff (ADMIN) on any document', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    mockFindUnique.mockResolvedValue(mockDocument);

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
    // Staff should NOT need assertCoachCanAccessStudent
    expect(mockAssert).not.toHaveBeenCalled();
  });

  it('returns 200 for staff (ASSISTANTE) on any document', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'assistante-1', role: 'ASSISTANTE' } });
    mockFindUnique.mockResolvedValue(mockDocument);

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
  });

  it('returns 404 for coach when visibilityScope is STUDENT_ONLY', async () => {
    mockAuth.mockResolvedValue({ user: { id: COACH_USER_ID, role: 'COACH' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'STUDENT_ONLY' });

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 200 for parent whose child owns the document (STUDENT_AND_PARENT scope)', async () => {
    mockAuth.mockResolvedValue({ user: { id: PARENT_USER_ID, role: 'PARENT' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'STUDENT_AND_PARENT' });
    mockParentFind.mockResolvedValue({ id: PARENT_PROFILE_ID });

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
  });

  it('returns 404 for parent on STUDENT_ONLY document', async () => {
    mockAuth.mockResolvedValue({ user: { id: PARENT_USER_ID, role: 'PARENT' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'STUDENT_ONLY' });

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 404 for parent not owning the student', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'other-parent', role: 'PARENT' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'STUDENT_AND_PARENT' });
    mockParentFind.mockResolvedValue({ id: 'other-parent-profile' }); // different parent

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 200 for student downloading their own document', async () => {
    mockAuth.mockResolvedValue({ user: { id: STUDENT_USER_ID, role: 'ELEVE' } });
    mockFindUnique.mockResolvedValue(mockDocument);

    const res = await GET(request(), params());

    expect(res.status).toBe(200);
  });

  it('returns 404 for student downloading own ADMIN_ONLY document', async () => {
    mockAuth.mockResolvedValue({ user: { id: STUDENT_USER_ID, role: 'ELEVE' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'ADMIN_ONLY' });

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 404 for parent downloading ADMIN_ONLY document of their child', async () => {
    mockAuth.mockResolvedValue({ user: { id: PARENT_USER_ID, role: 'PARENT' } });
    mockFindUnique.mockResolvedValue({ ...mockDocument, visibilityScope: 'ADMIN_ONLY' });

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('returns 404 on path traversal via /../ (P1 containment)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1', role: 'ADMIN' } });
    const { resolve: pathResolve } = require('path');
    const storageRoot = pathResolve(process.cwd(), 'storage', 'documents');
    const traversalPath = storageRoot + '/../../../.env.local';
    mockFindUnique.mockResolvedValue({ ...mockDocument, localPath: traversalPath });

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
    // readFile must NOT have been called (traversal blocked before I/O)
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('returns 404 for student downloading another student document', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'other-student', role: 'ELEVE' } });
    mockFindUnique.mockResolvedValue(mockDocument);

    const res = await GET(request(), params());

    expect(res.status).toBe(404);
  });

  it('end-to-end: sanitizeDocument URL resolves to a downloadable file', async () => {
    // Simulate the URL that sanitizeDocument generates
    const downloadUrl = `/api/documents/${DOC_ID}/download`;
    // Extract the document ID from the URL (as a client would)
    const match = downloadUrl.match(/^\/api\/documents\/([^/]+)\/download$/);
    expect(match).not.toBeNull();
    const extractedId = match![1];

    // Now call the download route with that ID
    mockAuth.mockResolvedValue({ user: { id: COACH_USER_ID, role: 'COACH' } });
    mockFindUnique.mockResolvedValue(mockDocument);
    mockAssert.mockResolvedValue(undefined);
    const fileContent = Buffer.from('%PDF-1.4 fake content');
    mockReadFile.mockResolvedValue(fileContent);

    const req = new NextRequest(`http://localhost/api/documents/${extractedId}/download`, { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: extractedId }) });

    expect(res.status).toBe(200);
    const body = await res.arrayBuffer();
    expect(Buffer.from(body)).toEqual(fileContent);
    // Verify readFile was called with the RESOLVED path (legacy prefix stripped, rebased to cwd)
    const { resolve: pathResolve } = require('path');
    const expectedPath = pathResolve(process.cwd(), 'storage', 'documents', 'student-user-1/test-doc.pdf');
    expect(mockReadFile).toHaveBeenCalledWith(expectedPath);
  });
});
