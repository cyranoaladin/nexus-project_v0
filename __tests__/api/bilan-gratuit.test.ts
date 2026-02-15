import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password')
}));

// Mock rate limiting (always allow)
jest.mock('../../lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue(null)
}));

// Mock cuid2
jest.mock('@paralleldrive/cuid2', () => ({
  createId: jest.fn().mockReturnValue('test-cuid-123')
}));

// Mock email service
jest.mock('../../lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined)
}));

describe('/api/bilan-gratuit', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const validRequestData = {
    // Informations Parent
    parentFirstName: 'Jean',
    parentLastName: 'Dupont',
    parentEmail: 'jean.dupont@test.com',
    parentPhone: '0123456789',
    parentPassword: 'motdepasse123',

    // Informations Élève
    studentFirstName: 'Marie',
    studentLastName: 'Dupont',
    studentGrade: 'Terminale',
    studentSchool: 'Lycée Victor Hugo',
    studentBirthDate: '2005-06-15',

    // Besoins et objectifs
    subjects: ['MATHEMATIQUES'],
    currentLevel: 'Moyen',
    objectives: 'Améliorer les notes en mathématiques pour le baccalauréat',
    difficulties: 'Difficultés avec les équations du second degré',

    // Préférences
    preferredModality: 'hybride',
    availability: 'Mercredi après-midi et weekend',

    // Consentements
    acceptTerms: true,
    acceptNewsletter: false
  };

  describe('POST /api/bilan-gratuit', () => {
    it('should return 201 and create parent and student when valid data is provided', async () => {
      // Setup mocks
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as any); // Email doesn't exist

      const mockParentUser = {
        id: 'parent-123',
        email: 'jean.dupont@test.com',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'PARENT',
        phone: '0123456789'
      };

      const mockStudentUser = {
        id: 'student-123',
        email: 'student-test-cuid-123@nexus-student.local',
        firstName: 'Marie',
        lastName: 'Dupont',
        role: 'ELEVE'
      };

      const mockStudent = {
        id: 'student-profile-123',
        parentId: 'parent-profile-123',
        userId: 'student-123',
        grade: 'Terminale'
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          user: {
            create: jest.fn()
              .mockResolvedValueOnce(mockParentUser)
              .mockResolvedValueOnce(mockStudentUser)
          },
          parentProfile: {
            create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' })
          },
          studentProfile: {
            create: jest.fn().mockResolvedValue({ id: 'student-profile-123' })
          },
          student: {
            create: jest.fn().mockResolvedValue(mockStudent)
          }
        } as any);
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Inscription réussie ! Vous recevrez un email de confirmation sous 24h.');
      expect(responseData.parentId).toBe('parent-123');
      expect(responseData.studentId).toBe('student-profile-123');

      // Verify database calls
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'jean.dupont@test.com' }
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should return 400 when parent email already exists', async () => {
      // Setup mock - email already exists
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: 'existing-user',
        email: 'jean.dupont@test.com'
      } as any);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Un compte existe déjà avec cet email');

      // Verify transaction was not called
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails (invalid email)', async () => {
      const invalidData = {
        ...validRequestData,
        parentEmail: 'invalid-email'
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides');
      expect(responseData.details).toBeDefined();
    });

    it('should return 400 when validation fails (password too short)', async () => {
      const invalidData = {
        ...validRequestData,
        parentPassword: '1234567' // Too short
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides');
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidData = {
        ...validRequestData,
        parentFirstName: undefined
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides');
    });

    it('should return 500 when database error occurs', async () => {
      // Setup mock - email doesn't exist but transaction fails
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as any);
      jest.spyOn(prisma, '$transaction').mockRejectedValue(new Error('Database connection failed'));

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Erreur interne du serveur');
    });

    it('should continue execution even if email sending fails', async () => {
      // Setup mocks - successful database operations but email fails
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null as any);

      const mockParentUser = {
        id: 'parent-123',
        email: 'jean.dupont@test.com',
        firstName: 'Jean',
        lastName: 'Dupont'
      };

      const mockStudentUser = {
        id: 'student-123',
        firstName: 'Marie',
        lastName: 'Dupont'
      };

      const mockStudent = {
        id: 'student-profile-123'
      };

      jest.spyOn(prisma, '$transaction').mockResolvedValue({
        parentUser: mockParentUser,
        studentUser: mockStudentUser,
        student: mockStudent
      } as any);

      // Mock email service to throw error
      const { sendWelcomeParentEmail } = await import('@/lib/email')
        ; (sendWelcomeParentEmail as jest.Mock).mockRejectedValue(new Error('Email service unavailable'));

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' }
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions - should succeed despite email failure
      expect(response.status).toBe(200);
      expect(responseData.success).toBe(true);
    });
  });
});
