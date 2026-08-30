/** @jest-environment node */

import { prisma } from '@/lib/prisma';
import { buildAriaConversationContext } from '@/lib/aria/application/conversation/public';

jest.mock('@/lib/prisma', () => ({
  prisma: { student: { findUnique: jest.fn() } },
}));

describe('ARIA canonical application boundary', () => {
  it('THREAD_NO_CHAT_REACHES_MODEL', async () => {
    (prisma.student.findUnique as jest.Mock).mockResolvedValue({
      id: 'student-stmg',
      userId: 'student-user-stmg',
      gradeLevel: 'PREMIERE',
      academicTrack: 'STMG',
      stmgPathway: null,
      academicEnrollments: [],
      ariaConversations: [],
      user: {
        entitlements: [{
          id: 'entitlement-stmg',
          productCode: 'ARIA_ACCESS',
          status: 'ACTIVE',
          startsAt: new Date('2026-08-01T00:00:00.000Z'),
          endsAt: null,
          ariaScopes: [{ kind: 'COURSE', courseKey: 'stmg-sgn-premiere' }],
        }],
      },
    });
    let modelInvocationCount = 0;

    await expect((async () => {
      await buildAriaConversationContext({
        actor: { userId: 'student-user-stmg', role: 'ELEVE' },
        courseKey: 'stmg-sgn-premiere',
        now: new Date('2026-08-30T12:00:00.000Z'),
      });
      modelInvocationCount += 1;
    })()).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(modelInvocationCount).toBe(0);
  });
});
