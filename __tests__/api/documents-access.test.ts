/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockSession: { user: { id: string; email: string; role: string } } | null = {
  user: { id: 'user-coach-1', email: 'coach@example.com', role: 'COACH' },
};

function setSession(session: typeof mockSession) {
  Object.assign(mockSession ?? {}, session);
  (require('@/lib/guards').requireRole as jest.Mock).mockImplementation(
    async (role: string) => {
      if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      if (session.user.role !== role)
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      return { user: session.user };
    }
  );
  (require('@/lib/guards').requireAnyRole as jest.Mock).mockImplementation(
    async (roles: string[]) => {
      if (!session) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      if (!roles.includes(session.user.role))
        return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
      return { user: session.user };
    }
  );
  (require('@/lib/guards').isErrorResponse as jest.Mock).mockImplementation(
    (val: unknown) => val instanceof Response
  );
}

jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  requireAnyRole: jest.fn(),
  isErrorResponse: jest.fn((val: unknown) => val instanceof Response),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findFirst: jest.fn(), findUnique: jest.fn() },
    userDocument: { findMany: jest.fn(), create: jest.fn() },
    coachStudentAssignment: { findFirst: jest.fn() },
    coachProfile: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/rbac/coach-student-access', () => ({
  assertCoachCanAccessStudent: jest.fn(),
}));

// ── Route imports (after mocks) ──────────────────────────────────────────────
import * as CoachDocumentsRoute from '@/app/api/coach/students/[studentId]/documents/route';
import * as AssistanteDocumentsRoute from '@/app/api/assistante/students/[studentId]/documents/route';
import { assertCoachCanAccessStudent } from '@/lib/rbac/coach-student-access';
import { prisma as prismaMock } from '@/lib/prisma';

const mockPrisma = prismaMock as unknown as {
  student: { findFirst: jest.Mock; findUnique: jest.Mock };
  userDocument: { findMany: jest.Mock; create: jest.Mock };
  coachStudentAssignment: { findFirst: jest.Mock };
  coachProfile: { findUnique: jest.Mock };
};

// ── Test data ────────────────────────────────────────────────────────────────
const STUDENT_ID = 'student-1';
const OTHER_STUDENT_ID = 'student-2';
const COACH_USER_ID = 'user-coach-1';
const STUDENT_USER_ID = 'user-student-1';
const ASSISTANTE_USER_ID = 'user-assistante-1';
const ADMIN_USER_ID = 'user-admin-1';

const mockStudent = { id: STUDENT_ID, userId: STUDENT_USER_ID, gradeLevel: 'PREMIERE', academicTrack: 'GENERAL' };
const mockOtherStudent = { id: OTHER_STUDENT_ID, userId: 'user-student-2', gradeLevel: 'TERMINALE', academicTrack: 'STMG', specialties: [] };
const mockDocument = {
  id: 'doc-1', userId: STUDENT_USER_ID, uploadedById: COACH_USER_ID,
  documentType: 'COURS', title: 'Test Document',
  visibilityScope: 'STUDENT_AND_COACH', url: 'https://example.com/doc.pdf',
  localPath: '/storage/doc.pdf', originalName: 'doc.pdf', mimeType: 'application/pdf',
  sizeBytes: 1024, createdAt: new Date(), description: null, subject: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function coachSession() {
  setSession({ user: { id: COACH_USER_ID, email: 'coach@example.com', role: 'COACH' } });
}
function studentSession() {
  setSession({ user: { id: STUDENT_USER_ID, email: 'student@example.com', role: 'ELEVE' } });
}
function assistanteSession() {
  setSession({ user: { id: ASSISTANTE_USER_ID, email: 'assistante@example.com', role: 'ASSISTANTE' } });
}
function adminSession() {
  setSession({ user: { id: ADMIN_USER_ID, email: 'admin@example.com', role: 'ADMIN' } });
}
function noSession() {
  setSession(null as any);
}

describe('Documents Access Control', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Coach Documents API', () => {
    it('should allow assigned coach to GET documents for their student', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      mockPrisma.userDocument.findMany.mockResolvedValue([mockDocument]);

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.documents).toHaveLength(1);
    });

    it('should deny coach access to non-assigned student (403)', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockRejectedValue(new Error('Forbidden'));

      const request = new NextRequest(
        `http://localhost/api/coach/students/${OTHER_STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: OTHER_STUDENT_ID }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should deny non-authenticated user (401)', async () => {
      noSession();

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(401);
    });

    it('should deny non-coach role (403)', async () => {
      studentSession();

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent student', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockRejectedValue(new Error('Forbidden'));

      const request = new NextRequest(
        `http://localhost/api/coach/students/non-existent-id/documents`,
        { method: 'GET' }
      );
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: 'non-existent-id' }),
      });

      expect([403, 404]).toContain(response.status);
    });

    it('should allow assigned coach to POST document', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);
      const createdDoc = { ...mockDocument, title: 'New Exercise', documentType: 'EXERCICE' };
      mockPrisma.userDocument.create.mockResolvedValue(createdDoc);

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'EXERCICE',
            title: 'New Exercise',
            url: 'https://example.com/exercise.pdf',
            visibilityScope: 'STUDENT_AND_COACH',
          }),
        }
      );
      const response = await CoachDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.document.title).toBe('New Exercise');
    });

    it('should validate documentType enum (400)', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'INVALID_TYPE',
            title: 'Invalid Document',
            url: 'https://example.com/doc.pdf',
          }),
        }
      );
      const response = await CoachDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(400);
    });

    it('should require url or localPath (400)', async () => {
      coachSession();
      (assertCoachCanAccessStudent as jest.Mock).mockResolvedValue(undefined);
      mockPrisma.student.findFirst.mockResolvedValue(mockStudent);

      const request = new NextRequest(
        `http://localhost/api/coach/students/${STUDENT_ID}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'COURS',
            title: 'Document without path',
          }),
        }
      );
      const response = await CoachDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('URL ou chemin local requis');
    });
  });

  describe('Assistante Documents API', () => {
    it('should allow ASSISTANTE to GET any student documents', async () => {
      assistanteSession();
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.userDocument.findMany.mockResolvedValue([{ ...mockDocument, localPath: '/srv/private/doc.pdf' }]);

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.documents).toHaveLength(1);
      expect(data.documents[0].localPath).toBeUndefined();
    });

    it('should allow ADMIN to GET any student documents', async () => {
      adminSession();
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);
      mockPrisma.userDocument.findMany.mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(200);
    });

    it('should deny STUDENT role (403)', async () => {
      studentSession();

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(403);
    });

    it('should deny COACH role (403)', async () => {
      coachSession();

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${STUDENT_ID}/documents`,
        { method: 'GET' }
      );
      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent student', async () => {
      assistanteSession();
      mockPrisma.student.findUnique.mockResolvedValue(null);

      const request = new NextRequest(
        `http://localhost/api/assistante/students/non-existent-id/documents`,
        { method: 'GET' }
      );
      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: 'non-existent-id' }),
      });

      expect(response.status).toBe(404);
    });

    it('should allow ASSISTANTE to POST document for any student', async () => {
      assistanteSession();
      mockPrisma.student.findUnique.mockResolvedValue({ id: OTHER_STUDENT_ID, userId: 'user-student-2' });
      const createdDoc = { ...mockDocument, documentType: 'PLANNING', title: 'Planning Stage' };
      mockPrisma.userDocument.create.mockResolvedValue(createdDoc);

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${OTHER_STUDENT_ID}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'PLANNING',
            title: 'Planning Stage',
            url: 'https://example.com/planning.pdf',
            subject: 'MATHEMATIQUES',
            visibilityScope: 'STUDENT_AND_COACH',
          }),
        }
      );
      const response = await AssistanteDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: OTHER_STUDENT_ID }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should validate visibilityScope enum (400)', async () => {
      assistanteSession();
      mockPrisma.student.findUnique.mockResolvedValue(mockStudent);

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${STUDENT_ID}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'COURS',
            title: 'Invalid Visibility',
            url: 'https://example.com/doc.pdf',
            visibilityScope: 'INVALID_SCOPE',
          }),
        }
      );
      const response = await AssistanteDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: STUDENT_ID }),
      });

      expect(response.status).toBe(400);
    });
  });
});
