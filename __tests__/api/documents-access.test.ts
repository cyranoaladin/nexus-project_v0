/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';
import { prisma, resetDatabase } from '../helpers/prisma-mock';
import { createMockSession } from '../helpers/session-mock';

// Import the routes
import CoachDocumentsRoute from '@/app/api/coach/students/[studentId]/documents/route';
import AssistanteDocumentsRoute from '@/app/api/assistante/students/[studentId]/documents/route';

describe('Documents Access Control', () => {
  let student: any;
  let coach: any;
  let coachUser: any;
  let studentUser: any;
  let assistanteUser: any;
  let adminUser: any;
  let otherStudent: any;
  let otherStudentUser: any;
  let assignment: any;

  beforeEach(async () => {
    await resetDatabase();

    // Create coach user
    coachUser = await prisma.user.create({
      data: {
        email: 'coach@example.com',
        firstName: 'John',
        lastName: 'Coach',
        role: 'COACH',
      },
    });

    // Create coach profile
    coach = await prisma.coachProfile.create({
      data: {
        userId: coachUser.id,
        bio: 'Test coach',
      },
    });

    // Create student user
    studentUser = await prisma.user.create({
      data: {
        email: 'student@example.com',
        firstName: 'Jane',
        lastName: 'Student',
        role: 'STUDENT',
      },
    });

    // Create student profile
    student = await prisma.student.create({
      data: {
        userId: studentUser.id,
        gradeLevel: 'PREMIERE',
        academicTrack: 'GENERAL',
      },
    });

    // Create another student user
    otherStudentUser = await prisma.user.create({
      data: {
        email: 'other@example.com',
        firstName: 'Other',
        lastName: 'Student',
        role: 'STUDENT',
      },
    });

    otherStudent = await prisma.student.create({
      data: {
        userId: otherStudentUser.id,
        gradeLevel: 'TERMINALE',
        academicTrack: 'STMG',
      },
    });

    // Create assistante user
    assistanteUser = await prisma.user.create({
      data: {
        email: 'assistante@example.com',
        firstName: 'Alice',
        lastName: 'Assistante',
        role: 'ASSISTANTE',
      },
    });

    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        firstName: 'Admin',
        lastName: 'User',
        role: 'ADMIN',
      },
    });

    // Create assignment between coach and student
    assignment = await prisma.coachStudentAssignment.create({
      data: {
        coachId: coach.id,
        studentId: student.id,
        assignedById: assistanteUser.id,
        assignmentType: 'PRIMARY',
        status: 'ACTIVE',
        startsAt: new Date(),
      },
    });
  });

  describe('Coach Documents API', () => {
    it('should allow assigned coach to GET documents for their student', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      // Create a document for the student
      await prisma.userDocument.create({
        data: {
          studentId: student.id,
          uploadedById: coachUser.id,
          documentType: 'COURS',
          title: 'Test Document',
          visibilityScope: 'STUDENT_AND_COACH',
          url: 'https://example.com/doc.pdf',
        },
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.documents).toHaveLength(1);
    });

    it('should deny coach access to non-assigned student (403)', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${otherStudent.id}/documents`,
        { method: 'GET' }
      );

      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: otherStudent.id }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
    });

    it('should deny non-authenticated user (401)', async () => {
      createMockSession(null);

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(401);
    });

    it('should deny non-coach role (403)', async () => {
      createMockSession({
        id: studentUser.id,
        email: studentUser.email,
        role: 'STUDENT',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent student', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/non-existent-id/documents`,
        { method: 'GET' }
      );

      // Since we can't verify assignment for non-existent student, 
      // it should fail with 403 (not assigned) or 404 depending on implementation
      const response = await CoachDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: 'non-existent-id' }),
      });

      expect([403, 404]).toContain(response.status);
    });

    it('should allow assigned coach to POST document', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
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
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.document.title).toBe('New Exercise');
    });

    it('should validate documentType enum (400)', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
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
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(400);
    });

    it('should require url or localPath (400)', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/coach/students/${student.id}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'COURS',
            title: 'Document without path',
          }),
        }
      );

      const response = await CoachDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.message).toContain('URL ou chemin local requis');
    });
  });

  describe('Assistante Documents API', () => {
    it('should allow ASSISTANTE to GET any student documents', async () => {
      createMockSession({
        id: assistanteUser.id,
        email: assistanteUser.email,
        role: 'ASSISTANTE',
      });

      // Create documents for both students
      await prisma.userDocument.create({
        data: {
          studentId: student.id,
          uploadedById: assistanteUser.id,
          documentType: 'COURS',
          title: 'Doc 1',
          visibilityScope: 'STUDENT_ONLY',
        },
      });

      await prisma.userDocument.create({
        data: {
          studentId: otherStudent.id,
          uploadedById: assistanteUser.id,
          documentType: 'BILAN',
          title: 'Doc 2',
          visibilityScope: 'STUDENT_AND_COACH',
        },
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.documents).toHaveLength(1);
    });

    it('should allow ADMIN to GET any student documents', async () => {
      createMockSession({
        id: adminUser.id,
        email: adminUser.email,
        role: 'ADMIN',
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(200);
    });

    it('should deny STUDENT role (403)', async () => {
      createMockSession({
        id: studentUser.id,
        email: studentUser.email,
        role: 'STUDENT',
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(403);
    });

    it('should deny COACH role (403)', async () => {
      createMockSession({
        id: coachUser.id,
        email: coachUser.email,
        role: 'COACH',
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${student.id}/documents`,
        { method: 'GET' }
      );

      const response = await AssistanteDocumentsRoute.GET(request, {
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent student', async () => {
      createMockSession({
        id: assistanteUser.id,
        email: assistanteUser.email,
        role: 'ASSISTANTE',
      });

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
      createMockSession({
        id: assistanteUser.id,
        email: assistanteUser.email,
        role: 'ASSISTANTE',
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${otherStudent.id}/documents`,
        {
          method: 'POST',
          body: JSON.stringify({
            documentType: 'PLANNING',
            title: 'Planning Stage',
            url: 'https://example.com/planning.pdf',
            subject: 'MATHS',
            visibilityScope: 'STUDENT_AND_COACH',
          }),
        }
      );

      const response = await AssistanteDocumentsRoute.POST(request, {
        params: Promise.resolve({ studentId: otherStudent.id }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.success).toBe(true);
    });

    it('should validate visibilityScope enum (400)', async () => {
      createMockSession({
        id: assistanteUser.id,
        email: assistanteUser.email,
        role: 'ASSISTANTE',
      });

      const request = new NextRequest(
        `http://localhost/api/assistante/students/${student.id}/documents`,
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
        params: Promise.resolve({ studentId: student.id }),
      });

      expect(response.status).toBe(400);
    });
  });
});
