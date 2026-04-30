import { NextResponse } from 'next/server';
import { GET, POST } from '@/app/api/eleve/questionnaire-eaf-stage-printemps/route';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/guards';

// Mock the guards
jest.mock('@/lib/guards', () => ({
  requireRole: jest.fn(),
  isErrorResponse: jest.fn((res) => res instanceof NextResponse),
}));

describe('EAF Questionnaire API Audit', () => {
  const mockStudentId = 'test-student-id';
  const mockUserId = 'test-user-id';
  const mockEmail = 'student@test.com';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security & Access Control', () => {
    it('should return 401 if not authenticated', async () => {
      (requireRole as jest.Mock).mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      );
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('should return 403 if user is not a student', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'COACH' } });
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue(null);
      const response = await GET();
      expect(response.status).toBe(404); // Not found if student profile missing
    });

    it('should return 403 if student is not in PREMIERE', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'ELEVE' } });
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
        id: mockStudentId,
        gradeLevel: 'TERMINALE',
        user: { firstName: 'Test', lastName: 'Student', email: mockEmail },
      } as any);
      const response = await GET();
      expect(response.status).toBe(403);
    });
  });

  describe('POST Validation & Payload', () => {
    it('should reject payload larger than 100KB', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'ELEVE' } });
      const req = new Request('http://localhost/api', {
        method: 'POST',
        headers: { 'content-length': '100001' },
        body: JSON.stringify({ answers: {} }),
      });
      const response = await POST(req);
      expect(response.status).toBe(413);
    });

    it('should reject invalid action', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'ELEVE' } });
      const req = new Request('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({ answers: {}, action: 'invalid' }),
      });
      const response = await POST(req);
      expect(response.status).toBe(400);
    });

    it('should prevent modification if already COMPLETED', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'ELEVE' } });
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
        id: mockStudentId,
        gradeLevel: 'PREMIERE',
        user: { email: mockEmail },
      } as any);
      jest.spyOn(prisma.bilan, 'findFirst').mockResolvedValue({ status: 'COMPLETED' } as any);

      const req = new Request('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({ answers: {}, action: 'draft' }),
      });
      const response = await POST(req);
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Locked');
    });
  });

  describe('Data Integrity', () => {
    it('should structure data correctly on save', async () => {
      (requireRole as jest.Mock).mockResolvedValue({ user: { id: mockUserId, role: 'ELEVE' } });
      jest.spyOn(prisma.student, 'findUnique').mockResolvedValue({
        id: mockStudentId,
        gradeLevel: 'PREMIERE',
        user: { email: mockEmail, firstName: 'Test', lastName: 'User' },
      } as any);
      jest.spyOn(prisma.bilan, 'findFirst').mockResolvedValue(null);
      const createSpy = jest.spyOn(prisma.bilan, 'create').mockResolvedValue({ id: 'new-id' } as any);

      const answers = { fullName: 'Test Name', beforeConfidence: '5' };
      const req = new Request('http://localhost/api', {
        method: 'POST',
        body: JSON.stringify({ answers, step: 0, action: 'draft' }),
      });

      await POST(req);
      
      const savedData = createSpy.mock.calls[0][0].data.sourceData as any;
      expect(savedData.meta.questionnaireSlug).toBe('eaf-stage-printemps-ecrit-francais');
      expect(savedData.answers.profile.fullName).toBe('Test Name');
      expect(savedData.answers.beforeStage.confidence).toBe('5');
    });
  });
});
