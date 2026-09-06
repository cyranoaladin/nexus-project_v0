import { auth } from '@/auth';
import * as studentCredits from '@/app/api/assistante/students/credits/route';
import * as creditRequests from '@/app/api/assistante/credit-requests/route';
import { prisma } from '@/lib/prisma';
jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({ prisma: { creditTransaction: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]) }, student: { findMany: jest.fn().mockResolvedValue([]) } } }));
const request = { url: 'http://localhost/api/credits', json: async () => ({ studentId: 'student-1', amount: 5, type: 'CREDIT_ADD', description: 'legacy client' }) } as any;
describe('Retired credit endpoints', () => {
  beforeEach(() => jest.clearAllMocks());
  for (const [name, handler] of Object.entries({ studentGET: studentCredits.GET, studentPOST: studentCredits.POST, requestsGET: creditRequests.GET, requestsPOST: creditRequests.POST })) {
    it.each(['ADMIN', 'ASSISTANTE'])(`${name} returns 410 for %s without reading or mutating balances`, async role => {
      (auth as jest.Mock).mockResolvedValue({ user: { role } });
      expect((await handler(request)).status).toBe(410);
      expect(prisma.creditTransaction.create).not.toHaveBeenCalled();
      expect(prisma.creditTransaction.findMany).not.toHaveBeenCalled();
      expect(prisma.student.findMany).not.toHaveBeenCalled();
    });
    it(`${name} returns a sober error when authentication fails`, async () => {
      (auth as jest.Mock).mockRejectedValue(new Error('private auth internals'));
      const response = await handler(request);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Internal server error' });
    });
    it.each([null, 'ELEVE', 'PARENT', 'COACH'])(`${name} preserves denied access for %s`, async role => {
      (auth as jest.Mock).mockResolvedValue(role ? { user: { role } } : null);
      expect((await handler(request)).status).toBe(401);
    });
  }
});
