/**
 * Tests P0-03: Child creation must NOT reuse parent's password.
 * Must generate random hashed password + activation token.
 */

import { POST as createChild } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { auth } from '@/auth';

jest.mock('@/auth');

function mockParentSession(userId = 'parent-1') {
  (auth as jest.Mock).mockResolvedValue({
    user: { id: userId, role: 'PARENT', email: 'parent@example.com' },
  });
}

function req(body: object) {
  return new NextRequest('http://localhost/api/parent/children', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/parent/children — P0-03 hardening', () => {
  beforeEach(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'nexus-student.local' } } });
    await prisma.parentProfile.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'parent@example.com' } });

    const parentUser = await prisma.user.create({
      data: { email: 'parent@example.com', password: 'parent-hash-123', role: 'PARENT', firstName: 'P', lastName: 'A' },
    });
    await prisma.parentProfile.create({
      data: { userId: parentUser.id },
    });
    mockParentSession(parentUser.id);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates child with random password (not parent password) and activation token', async () => {
    const response = await createChild(req({ firstName: 'Jean', lastName: 'Dupont', grade: 'Terminale', school: 'Lycée' }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.child).toBeDefined();
    expect(json.activation).toBeDefined();
    expect(json.activation.token).toMatch(/^act_/);

    const user = await prisma.user.findUnique({ where: { id: json.child.id } });
    expect(user).toBeTruthy();
    expect(user?.password).not.toBe('parent-hash-123');
    expect(user?.activatedAt).toBeNull();
    expect(user?.activationToken).toBeTruthy();
    expect(user?.activationExpiry).toBeInstanceOf(Date);
  });

  it('returns 401 for non-parent', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
    const response = await createChild(req({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
    expect(response.status).toBe(401);
  });
});
