/**
 * IDOR Real Database Integration Test
 *
 * Prouve l'isolation réelle au niveau BDD.
 * Ne mocke PAS Prisma.
 */

// 1. Unmock Prisma
jest.unmock('@/lib/prisma');

// 2. Mock Auth
jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

import { GET } from '@/app/api/stages/[stageSlug]/bilans/route';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;

function makeGetRequest(stageSlug: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api/stages/${stageSlug}/bilans`, {
    method: 'GET',
  });
}

const TEST_COACH_EMAILS = ['coach-a@test.com', 'coach-b@test.com'];
const TEST_STAGE_SLUGS = ['stage-a-real', 'stage-b-real'];

async function cleanupCoachStageFixtures() {
  const users = await prisma.user.findMany({
    where: { email: { in: TEST_COACH_EMAILS } },
    select: { id: true },
  });
  const userIds = users.map(({ id }) => id);
  const coaches = await prisma.coachProfile.findMany({
    where: { userId: { in: userIds } },
    select: { id: true },
  });
  const coachIds = coaches.map(({ id }) => id);
  const stages = await prisma.stage.findMany({
    where: { slug: { in: TEST_STAGE_SLUGS } },
    select: { id: true },
  });
  const stageIds = stages.map(({ id }) => id);

  await prisma.stageCoach.deleteMany({
    where: {
      OR: [
        { coachId: { in: coachIds } },
        { stageId: { in: stageIds } },
      ],
    },
  });
  await prisma.coachProfile.deleteMany({ where: { id: { in: coachIds } } });
  await prisma.stage.deleteMany({ where: { id: { in: stageIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

describe('IDOR BDD Réelle — Coach Stage Isolation', () => {
  let stageA: any;
  let stageB: any;
  let coachA: any;
  let coachB: any;

  beforeAll(async () => {
    // Nettoyage initial limité aux fixtures de cette suite.
    await cleanupCoachStageFixtures();

    // Seed User A
    const userA = await prisma.user.create({
      data: { email: 'coach-a@test.com', role: 'COACH' },
    });
    // Seed User B
    const userB = await prisma.user.create({
      data: { email: 'coach-b@test.com', role: 'COACH' },
    });

    // Seed Profiles
    coachA = await prisma.coachProfile.create({
      data: { userId: userA.id, pseudonym: 'Coach A' },
    });
    coachB = await prisma.coachProfile.create({
      data: { userId: userB.id, pseudonym: 'Coach B' },
    });

    // Seed Stages
    stageA = await prisma.stage.create({
      data: {
        title: 'Stage A',
        slug: 'stage-a-real',
        priceAmount: 100,
        capacity: 10,
        startDate: new Date(),
        endDate: new Date(),
        isOpen: true,
        isVisible: true,
      },
    });
    stageB = await prisma.stage.create({
      data: {
        title: 'Stage B',
        slug: 'stage-b-real',
        priceAmount: 100,
        capacity: 10,
        startDate: new Date(),
        endDate: new Date(),
        isOpen: true,
        isVisible: true,
      },
    });

    // Assignations
    await prisma.stageCoach.create({
      data: { stageId: stageA.id, coachId: coachA.id },
    });
    await prisma.stageCoach.create({
      data: { stageId: stageB.id, coachId: coachB.id },
    });
  });

  afterAll(async () => {
    await cleanupCoachStageFixtures();
    await prisma.$disconnect();
  });

  it('✅ Coach A accède à son Stage A (BDD Réelle)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: coachA.userId, role: 'COACH', email: 'coach-a@test.com' },
    });

    const params = Promise.resolve({ stageSlug: stageA.slug });
    const res = await GET(makeGetRequest(stageA.slug), { params });

    expect(res.status).toBe(200);
  });

  it('🔴 Coach A tente d\'accéder au Stage B — DOIT être bloqué (403 BDD Réelle)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: coachA.userId, role: 'COACH', email: 'coach-a@test.com' },
    });

    const params = Promise.resolve({ stageSlug: stageB.slug });
    const res = await GET(makeGetRequest(stageB.slug), { params });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('assigné');
  });

  it('✅ Coach B accède à son Stage B (BDD Réelle)', async () => {
    mockAuth.mockResolvedValue({
      user: { id: coachB.userId, role: 'COACH', email: 'coach-b@test.com' },
    });

    const params = Promise.resolve({ stageSlug: stageB.slug });
    const res = await GET(makeGetRequest(stageB.slug), { params });

    expect(res.status).toBe(200);
  });
});
