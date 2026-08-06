/**
 * Activate Student Real Database Integration Test
 *
 * Prouve l'isolation réelle au niveau BDD pour la parentalité.
 * Ne mocke PAS Prisma.
 */

jest.unmock('@/lib/prisma');
jest.mock('@/auth', () => ({ auth: jest.fn() }));
// Ne PAS mocker initiateStudentActivation car on veut tester son accès DB interne
jest.mock('@/lib/email', () => ({
  sendStudentActivationEmail: jest.fn(),
}));

import { POST } from '@/app/api/assistante/activate-student/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/assistant/activate-student', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validTrackMetadata = {
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  specialties: ['MATHEMATIQUES'],
};

async function cleanupActivateStudentFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'activate-real-' } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);

  if (userIds.length === 0) return;

  await prisma.student.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.parentProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('IDOR BDD Réelle — Activate Student', () => {
  let parent1: any;
  let parent2: any;
  let student1: any;

  beforeAll(async () => {
    // Nettoyage initial limité aux fixtures de cette suite.
    await cleanupActivateStudentFixtures();

    // Seed User P1
    const uP1 = await prisma.user.create({
      data: { email: 'activate-real-p1@test.com', role: 'PARENT' },
    });
    // Seed User P2
    const uP2 = await prisma.user.create({
      data: { email: 'activate-real-p2@test.com', role: 'PARENT' },
    });
    // Seed User Student
    const uS1 = await prisma.user.create({
      data: { email: 'activate-real-s1@test.com', role: 'ELEVE' },
    });

    // Seed Profiles
    parent1 = await prisma.parentProfile.create({
      data: { userId: uP1.id },
    });
    parent2 = await prisma.parentProfile.create({
      data: { userId: uP2.id },
    });
    student1 = await prisma.student.create({
      data: { 
        userId: uS1.id, 
        parentId: parent1.id,
        gradeLevel: 'PREMIERE',
        academicTrack: 'EDS_GENERALE'
      }, // Lien Parent 1 <-> Student 1
    });
  });

  afterAll(async () => {
    await cleanupActivateStudentFixtures();
    await prisma.$disconnect();
  });

  it('✅ PARENT avec lien parental valide → 200', async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent1.userId, role: 'PARENT', email: 'activate-real-p1@test.com' },
    });

    const res = await POST(makePostRequest({
      studentUserId: student1.userId,
      studentEmail: 'activate-real-new-email@test.com',
      ...validTrackMetadata,
    }));

    expect(res.status).toBe(200);
  });

  it('🔴 PARENT sans lien parental → 403', async () => {
    mockAuth.mockResolvedValue({
      user: { id: parent2.userId, role: 'PARENT', email: 'activate-real-p2@test.com' },
    });

    const res = await POST(makePostRequest({
      studentUserId: student1.userId,
      studentEmail: 'activate-real-new-email2@test.com',
      ...validTrackMetadata,
    }));

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('parent');
  });
});
