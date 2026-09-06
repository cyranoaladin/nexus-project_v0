import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/children/route';
import { prisma } from '@/lib/prisma';
import { enqueueEmailIntent } from '@/lib/email/outbox';
import { FAMILY_REQUEST_CONSENT_VERSION } from '@/lib/families/requests';

jest.mock('@/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentProfile: { findUnique: jest.fn() },
    student: { findMany: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
    familyRequest: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'email-job-1' }),
}));

jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));

function makeRequest(body?: any) {
  const bodyStr = body !== undefined ? JSON.stringify(body) : '';
  return {
    method: 'POST',
    json: async () => body,
    text: async () => bodyStr,
    headers: new Headers({ 'content-length': String(Buffer.byteLength(bodyStr)) }),
    body: {
      getReader() {
        let done = false;
        return {
          async read() {
            if (done) return { done: true, value: undefined };
            done = true;
            return { done: false, value: new TextEncoder().encode(bodyStr) };
          },
          releaseLock() {},
        };
      },
    },
  } as any;
}

describe('parent children routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
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
          sessions: [{ id: 'session-1' }],
        },
      ]);

      const response = await GET(makeRequest());
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toHaveLength(1);
      // Le solde de crédits n'est plus exposé au parent.
      expect(body[0].creditBalance).toBeUndefined();
      expect(body[0].upcomingSessions).toBe(1);
    });
  });

  describe('POST /api/parent/children', () => {
    function mockParentProfile(overrides: Partial<{ id: string; user: Record<string, unknown> }> = {}) {
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue({
        id: overrides.id ?? 'parent-profile-1',
        user: {
          firstName: 'Parent',
          lastName: 'Test',
          email: 'parent@test.com',
          phone: '99000001',
          phoneNormalized: '99000001',
          ...overrides.user,
        },
      });
    }

    function mockFamilyRequestCreate(id = 'family-request-1') {
      const familyRequestCreate = jest.fn().mockResolvedValue({ id });
      (prisma.$transaction as jest.Mock).mockImplementation(async (callback: any) => callback({
        familyRequest: { create: familyRequestCreate },
      }));
      return familyRequestCreate;
    }

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

    it('returns 404 when parent profile missing', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      (prisma.parentProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await POST(
        makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' })
      );
      const body = await response.json();

      expect(response.status).toBe(404);
      expect(body.error).toBe('Parent profile not found');
    });

    it('creates an ADD_CHILD FamilyRequest (+ one child) and zero User/Student rows', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', email: 'parent@test.com', role: 'PARENT' },
      });
      mockParentProfile({ id: 'parent-profile-1' });
      const familyRequestCreate = mockFamilyRequestCreate();
      const userCreate = jest.fn();
      const studentCreate = jest.fn();
      (prisma.user.create as jest.Mock).mockImplementation(userCreate);
      (prisma.student.create as jest.Mock).mockImplementation(studentCreate);

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body).not.toHaveProperty('activation');
      expect(response.headers.get('cache-control')).toContain('private');
      expect(response.headers.get('cache-control')).toContain('no-store');

      expect(userCreate).not.toHaveBeenCalled();
      expect(studentCreate).not.toHaveBeenCalled();
      expect(enqueueEmailIntent).not.toHaveBeenCalled();

      expect(familyRequestCreate).toHaveBeenCalledTimes(1);
      const call = familyRequestCreate.mock.calls[0][0];
      expect(call.data).toEqual(expect.objectContaining({
        type: 'ADD_CHILD',
        requestingParentProfileId: 'parent-profile-1',
        contactFirstName: 'Parent',
        contactLastName: 'Test',
        contactEmail: 'parent@test.com',
        consentVersion: FAMILY_REQUEST_CONSENT_VERSION,
        consentAt: expect.any(Date),
      }));
      expect(call.data.children.create).toHaveLength(1);
      expect(call.data.children.create[0]).toEqual(expect.objectContaining({
        firstName: 'A',
        lastName: 'B',
        gradeLevel: 'SECONDE',
      }));
    });

    it('permet au parent sans email de demander l’ajout d’un enfant', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', email: null, role: 'PARENT' } });
      mockParentProfile({ user: { email: null } });
      const familyRequestCreate = mockFamilyRequestCreate();

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));

      expect(response.status).toBe(200);
      expect(familyRequestCreate).toHaveBeenCalledTimes(1);
      expect(enqueueEmailIntent).not.toHaveBeenCalled();
    });

    it('returns 400 for an unrecognized grade without touching the database', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'parent-1', role: 'PARENT' } });
      mockParentProfile();
      const familyRequestCreate = mockFamilyRequestCreate();

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Not a grade' }));
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toContain('Niveau scolaire non reconnu');
      expect(familyRequestCreate).not.toHaveBeenCalled();
    });

    it('rejects injected fields and does not create a request', async () => {
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', role: 'PARENT' },
      });
      mockParentProfile();
      const familyRequestCreate = mockFamilyRequestCreate();

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
      expect(familyRequestCreate).not.toHaveBeenCalled();
    });

    it('returns 500 without leaking internals when persistence fails', async () => {
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      (auth as jest.Mock).mockResolvedValue({
        user: { id: 'parent-1', email: 'parent@test.com', role: 'PARENT' },
      });
      mockParentProfile();
      (prisma.$transaction as jest.Mock).mockRejectedValue(new Error('db down'));

      const response = await POST(makeRequest({ firstName: 'A', lastName: 'B', grade: 'Seconde' }));
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('Internal server error');
      log.mockRestore();
    });
  });
});
