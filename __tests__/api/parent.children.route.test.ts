import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/email/mailer';
import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/bilans/parent-student-consent', () => ({
  withParentStudentConsentTransaction: jest.fn(),
}));

const mockWithParentStudentConsentTransaction = withParentStudentConsentTransaction as jest.MockedFunction<
  typeof withParentStudentConsentTransaction
>;
const mockPreparePending = jest.fn();
const mockConsentTransactionImplementation: typeof withParentStudentConsentTransaction = (
  database,
  action,
) => database.$transaction((transaction) => action({
  transaction,
  preparePending: mockPreparePending,
  verify: jest.fn(),
  getStatus: jest.fn(),
}));

function makeRequest(body?: any) {
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  return {
    json: async () => body,
    text: async () => bodyStr,
    headers: new Headers(),
  } as any;
}

describe('parent children routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPreparePending.mockResolvedValue({
      id: 'canonical-link-1',
      state: 'PENDING_PARENT_CONSENT',
      consentedAt: null,
      verifiedAt: null,
    });
    mockWithParentStudentConsentTransaction.mockImplementation(mockConsentTransactionImplementation);
  });

  describe('GET /api/parent/children', () => {
    it('returns 401 when not parent', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 404 when parent profile missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent profile not found');
    });

    it('returns formatted children', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.student.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'student-1',
          grade: 'Seconde',
          school: 'Lycée',
          createdAt: new Date('2025-01-01'),
          user: { firstName: 'Student', lastName: 'One', email: 's1@test.com' },
          creditTransactions: [{ amount: 2 }, { amount: -1 }],
          sessions: [{ id: 'session-1' }],
        },
      ]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      expect(body[0].creditBalance).toBe(1);
      expect(body[0].upcomingSessions).toBe(1);
    });
  });

  describe('POST /api/parent/children', () => {
    it('returns 401 when not parent', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await POST(makeRequest({}));
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('validates required fields', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });

      const response = await POST(makeRequest({ firstName: 'A' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid child payload');
    });

    it('maps the database uniqueness authority to a stable conflict without partial response', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', email: 'parent@test.com', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.$transaction as jest.Mock).mockRejectedValue(Object.assign(
        new Error('unique email collision'),
        { code: 'P2002', meta: { target: ['email'] } },
      ));

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe('STUDENT_LOGIN_IDENTIFIER_CONFLICT');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('returns 404 when parent profile missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent profile not found');
    });

    it('creates the child and prepares a pending Canonical link from server-owned ids', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', email: 'parent@test.com', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      const student = {
        id: 'student-1',
        grade: 'Seconde',
        school: '',
        user: { firstName: 'A', lastName: 'B', email: 'a.b@nexus-student.local' },
      };
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
        user: { create: jest.fn().mockResolvedValue({ id: 'child-user-1' }) },
        student: { create: jest.fn().mockResolvedValue(student) },
      }));

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));

      expect(response.status).toBe(200);
      expect(mockWithParentStudentConsentTransaction).toHaveBeenCalledWith(
        prisma,
        expect.any(Function),
      );
      expect(mockPreparePending).toHaveBeenCalledWith({
        parentUserId: 'parent-1',
        studentId: 'student-1',
        now: expect.any(Date),
      });
      expect(mockPreparePending).toHaveBeenCalledTimes(1);
      expect(sendMail).toHaveBeenCalledTimes(1);
    });

    it('aborts child creation response and sends no email when pending consent preparation fails', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', email: 'parent@test.com', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
        user: { create: jest.fn().mockResolvedValue({ id: 'child-user-1' }) },
        student: {
          create: jest.fn().mockResolvedValue({
            id: 'student-1',
            grade: 'Seconde',
            school: '',
            user: { firstName: 'A', lastName: 'B', email: 'a.b@nexus-student.local' },
          }),
        },
      }));
      mockPreparePending.mockRejectedValueOnce(new Error('pending link failed'));

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      expect(mockPreparePending).toHaveBeenCalledWith({
        parentUserId: 'parent-1',
        studentId: 'student-1',
        now: expect.any(Date),
      });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('rejects injected fields and does not create a child', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(null);
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({ id: 'parent-profile-1' });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb: any) => {
        const tx = {
          user: {
            create: jest.fn().mockResolvedValue({ id: 'child-user-1', email: 'a.b@nexus-student.local' }),
          },
          student: {
            create: jest.fn().mockResolvedValue({
              id: 'student-1',
              grade: 'Seconde',
              school: '',
              user: { firstName: 'A', lastName: 'B', email: 'a.b@nexus-student.local' },
            }),
          },
        };
        return cb(tx);
      });

      const response = await POST(
        makeRequest({
          firstName: 'A',
          lastName: 'B',
          grade: 'Seconde',
          school: '',
          parentPassword: 'secret-should-be-ignored',
        })
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('Invalid child payload');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
