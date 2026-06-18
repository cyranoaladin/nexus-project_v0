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
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.parentProfile.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.userId === 'parent-a') return Promise.resolve({ id: 'profile-a' });
      if (where?.userId === 'parent-b') return Promise.resolve({ id: 'profile-b' });
      return Promise.resolve(null);
    });
    (prisma.student.findMany as jest.Mock).mockImplementation(({ where }: any) => {
      if (where?.parentId === 'profile-a') {
        return Promise.resolve([
          {
            id: 'student-a',
            grade: 'Terminale',
            school: 'Lycée A',
            createdAt: new Date('2025-01-01'),
            user: { firstName: 'C', lastName: 'A', email: 'child.a@test.com' },
            creditTransactions: [],
            sessions: [],
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('returns own children for parent A', async () => {
    mockSession('parent-a', 'PARENT');
    const response = await getChildren(new NextRequest('http://localhost/api/parent/children'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toHaveLength(1);
    expect(json[0].firstName).toBe('C');
  });

  it('returns empty for parent B (no children)', async () => {
    mockSession('parent-b', 'PARENT');
    const response = await getChildren(new NextRequest('http://localhost/api/parent/children'));
    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json).toHaveLength(0);
  });
});
