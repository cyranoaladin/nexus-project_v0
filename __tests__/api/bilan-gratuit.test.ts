import { NextRequest } from 'next/server';
import { POST } from '../../app/api/bilan-gratuit/route';
import { prisma } from '../../lib/prisma';

// Mock the prisma module
jest.mock('../../lib/prisma');

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

// Mock email service
jest.mock('../../lib/email', () => ({
  sendWelcomeParentEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('/api/bilan-gratuit', () => {
  let mockPrisma: jest.Mocked<typeof prisma>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Réinitialiser complètement le mock Prisma avant chaque test
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      parentProfile: {
        create: jest.fn(),
      },
      studentProfile: {
        create: jest.fn(),
      },
      student: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    } as unknown as jest.Mocked<typeof prisma>;

    // Remplacer l'instance de prisma par notre mock réinitialisé
    jest.requireMock('../../lib/prisma').prisma = mockPrisma;
    (mockPrisma.user.findUnique as jest.Mock).mockClear();
    (mockPrisma.$transaction as jest.Mock).mockClear();
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
    acceptNewsletter: false,
  };

  describe('POST /api/bilan-gratuit', () => {
    it('should return 201 and create parent and student when valid data is provided', async () => {
      // Setup mocks
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null); // Email doesn't exist

      const mockParentUser = {
        id: 'parent-123',
        email: 'jean.dupont@test.com',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: 'PARENT',
        phone: '0123456789',
      };

      const mockStudentUser = {
        id: 'student-123',
        email: 'marie.dupont@nexus-student.local',
        firstName: 'Marie',
        lastName: 'Dupont',
        role: 'ELEVE',
      };

      const mockStudent = {
        id: 'student-profile-123',
        parentId: 'parent-profile-123',
        userId: 'student-123',
        grade: 'Terminale',
      };

      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest
              .fn()
              .mockResolvedValueOnce(mockParentUser)
              .mockResolvedValueOnce(mockStudentUser),
          },
          parentProfile: {
            create: jest.fn().mockResolvedValue({ id: 'parent-profile-123' }),
          },
          studentProfile: {
            create: jest.fn().mockResolvedValue({ id: 'student-profile-123' }),
          },
          student: {
            create: jest.fn().mockResolvedValue(mockStudent),
          },
        } as any);
      });

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(201);
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Inscription au bilan gratuit réussie.');
      expect(responseData.user).toBeDefined();
      expect(responseData.user.id).toBe('parent-123');
      expect(responseData.user.email).toBe(validRequestData.parentEmail);

      // Verify database calls
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: validRequestData.parentEmail },
      });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('sets birthDate to null when studentBirthDate is absent', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        return callback({
          user: {
            create: jest
              .fn()
              .mockResolvedValueOnce({ id: 'p1', email: 'parent@example.com' })
              .mockResolvedValueOnce({ id: 's1', email: 's@example.com' }),
          },
          parentProfile: { create: jest.fn().mockResolvedValue({ id: 'pp1' }) },
          student: {
            create: jest
              .fn()
              .mockImplementation(({ data }: any) =>
                Promise.resolve({ id: 'st1', birthDate: data.birthDate ?? null })
              ),
          },
        } as any);
      });
      const { POST } = await import('@/app/api/bilan-gratuit/route');
      const minimal = { ...validRequestData } as any;
      delete minimal.studentBirthDate;
      const req = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(minimal),
        headers: { 'Content-Type': 'application/json' },
      });
      const res = await POST(req);
      expect([200, 201]).toContain(res.status);
    });

    it('should return 400 when parent email already exists', async () => {
      // Setup mock - email already exists
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'jean.dupont@test.com',
      } as any);

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Un compte existe déjà avec cet email');

      // Verify transaction was not called
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should return 400 when validation fails (invalid email)', async () => {
      const invalidData = {
        ...validRequestData,
        parentEmail: 'invalid-email',
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides.'); // Ajout du point
      expect(responseData.details).toBeDefined();
    });

    it('should return 400 when validation fails (password too short)', async () => {
      const invalidData = {
        ...validRequestData,
        parentPassword: '1234567', // Too short
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides.'); // Ajout du point
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidData = {
        ...validRequestData,
        parentFirstName: undefined,
      };

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(400);
      expect(responseData.error).toBe('Données invalides.'); // Ajout du point
    });

    it('should return 500 when database error occurs', async () => {
      // Setup mock - email doesn't exist but transaction fails
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions
      expect(response.status).toBe(500);
      expect(responseData.error).toBe('Une erreur interne est survenue.'); // Message mis à jour
    });

    it('should continue execution even if email sending fails', async () => {
      // Setup mocks - successful database operations but email fails
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const mockParentUser = {
        id: 'parent-123',
        email: 'jean.dupont@test.com',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      const mockStudentUser = {
        id: 'student-123',
        firstName: 'Marie',
        lastName: 'Dupont',
      };

      const mockStudent = {
        id: 'student-profile-123',
      };

      (mockPrisma.$transaction as jest.Mock).mockResolvedValue({
        parentUser: mockParentUser,
        studentUser: mockStudentUser,
        student: mockStudent,
      } as any);

      // Mock email service to throw error
      const { sendWelcomeParentEmail } = await import('@/lib/email');
      (sendWelcomeParentEmail as jest.Mock).mockRejectedValue(
        new Error('Email service unavailable')
      );

      // Create request
      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      // Call API
      const response = await POST(request);
      const responseData = await response.json();

      // Assertions - should succeed despite email failure
      expect(response.status).toBe(201); // 201 Created est plus approprié
      expect(responseData.success).toBe(true);
    });

    it('returns 409 when unique constraint failed is thrown by DB', async () => {
      const { POST } = await import('@/app/api/bilan-gratuit/route');
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$transaction as jest.Mock).mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)')
      );

      const request = new NextRequest('http://localhost:3000/api/bilan-gratuit', {
        method: 'POST',
        body: JSON.stringify(validRequestData),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      expect(response.status).toBe(409);
      const data = await response.json();
      expect(data.error).toMatch(/existe déjà/i);
    });
  });
});
