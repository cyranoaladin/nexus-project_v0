/**
 * Predict Ownership Real Database Integration Test
 *
 * Prouve l'isolation réelle au niveau BDD pour la prédiction SSN.
 * Ne mocke PAS Prisma.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));

// On mocke la fonction métier de prédiction pour ne pas complexifier avec les vraies données d'assessment
// On veut juste tester la couche de protection RBAC/Ownership dans la route
jest.mock('@/lib/core/ml/predictSSN', () => ({
  predictSSNForStudent: jest.fn(),
}));

import { POST } from '@/app/api/assessments/predict/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { predictSSNForStudent } from '@/lib/core/ml/predictSSN';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockPredict = predictSSNForStudent as jest.Mock;

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/assessments/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('IDOR BDD Réelle — Predict Ownership', () => {
  let coach1: any;
  let coach2: any;
  let parent: any;
  let student1: any;

  beforeAll(async () => {
    // Nettoyage initial
    await prisma.sessionBooking.deleteMany();
    await prisma.coachProfile.deleteMany();
    await prisma.parentProfile.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'predict-real-' } },
    });

    // Seed Users
    const uC1 = await prisma.user.create({ data: { email: 'predict-real-c1@test.com', role: 'COACH' } });
    const uC2 = await prisma.user.create({ data: { email: 'predict-real-c2@test.com', role: 'COACH' } });
    const uP = await prisma.user.create({ data: { email: 'predict-real-p@test.com', role: 'PARENT' } });
    const uS1 = await prisma.user.create({ data: { email: 'predict-real-s1@test.com', role: 'ELEVE' } });

    // Seed Profiles
    coach1 = await prisma.coachProfile.create({ data: { userId: uC1.id, pseudonym: 'Coach 1' } });
    coach2 = await prisma.coachProfile.create({ data: { userId: uC2.id, pseudonym: 'Coach 2' } });
    parent = await prisma.parentProfile.create({ data: { userId: uP.id } });
    
    // Link Parent to Student 1
    student1 = await prisma.student.create({ data: { userId: uS1.id, parentId: parent.id } });

    // Coach 1 a une séance avec Student 1
    await prisma.sessionBooking.create({
      data: {
        studentId: uS1.id,
        coachId: uC1.id,
        scheduledDate: new Date(),
        startTime: '14:00',
        endTime: '15:00',
        duration: 60,
        subject: 'MATHEMATIQUES',
        title: 'Séance de test',
        status: 'SCHEDULED',
      },
    });
  });

  afterAll(async () => {
    await prisma.sessionBooking.deleteMany();
    await prisma.coachProfile.deleteMany();
    await prisma.parentProfile.deleteMany();
    await prisma.student.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'predict-real-' } },
    });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPredict.mockResolvedValue({ ssnProjected: 70, confidence: 0.8 }); // Retour par défaut pour les cas autorisés
  });

  it('✅ COACH avec séance valide → 200', async () => {
    mockAuth.mockResolvedValue({
      user: { id: coach1.userId, role: 'COACH', email: 'predict-real-c1@test.com' },
    });

    const res = await POST(makePostRequest({ studentId: student1.userId }));
    expect(res.status).toBe(200);
  });

  it('🔴 COACH sans séance → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: coach2.userId, role: 'COACH', email: 'predict-real-c2@test.com' },
    });

    const res = await POST(makePostRequest({ studentId: student1.userId }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Aucune séance');
  });

  it('✅ PARENT avec lien valide → 200', async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent.userId, role: 'PARENT', email: 'predict-real-p@test.com' },
    });

    const res = await POST(makePostRequest({ studentId: student1.userId }));
    expect(res.status).toBe(200);
  });

  it('🔴 PARENT sans lien parental → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent.userId, role: 'PARENT', email: 'predict-real-p@test.com' },
    });

    // Demande sur un étudiant non lié
    const res = await POST(makePostRequest({ studentId: 'student-fantome-123' }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('Accès refusé');
  });

  it('🔴 Rôle non autorisé (ELEVE) → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: student1.userId, role: 'ELEVE', email: 'predict-real-s1@test.com' },
    });

    const res = await POST(makePostRequest({ studentId: student1.userId }));
    expect(res.status).toBe(403);
  });
});
