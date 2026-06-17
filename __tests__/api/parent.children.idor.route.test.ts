/**
 * Tests P0-02: IDOR — Parent A must not access Parent B's children.
 */

import { GET as getChildren } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth');

function mockSession(userId: string, role: string) {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: userId, role, email: `${userId}@test.com` },
  });
}

describe('GET /api/parent/children — IDOR (P0-02)', () => {
  let parentA: any;
  let parentB: any;
  let childA: any;

  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '@test.com' } } });
    await prisma.parentProfile.deleteMany();

    parentA = await prisma.user.create({
      data: { email: 'parent-a@test.com', password: 'hash-a', role: 'PARENT', firstName: 'PA', lastName: 'A' },
    });
    const profileA = await prisma.parentProfile.create({ data: { userId: parentA.id } });

    parentB = await prisma.user.create({
      data: { email: 'parent-b@test.com', password: 'hash-b', role: 'PARENT', firstName: 'PB', lastName: 'B' },
    });
    const profileB = await prisma.parentProfile.create({ data: { userId: parentB.id } });

    const childUser = await prisma.user.create({
      data: { email: 'child.a@test.com', password: 'hash-c', role: 'ELEVE', firstName: 'C', lastName: 'A' },
    });
    childA = await prisma.student.create({
      data: { userId: childUser.id, parentId: profileA.id, grade: 'Terminale', gradeLevel: 'TERMINALE', academicTrack: 'GENERAL' },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns own children for parent A', async () => {
    mockSession(parentA.id, 'PARENT');
    const response = await getChildren(new NextRequest('http://localhost/api/parent/children'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].firstName).toBe('C');
  });

  it('returns empty for parent B (no children)', async () => {
    mockSession(parentB.id, 'PARENT');
    const response = await getChildren(new NextRequest('http://localhost/api/parent/children'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toHaveLength(0);
  });
});
