import { auth } from '@/auth';
import { GET, POST } from '@/app/api/parent/children/[studentId]/canonical-consent/route';
import {
  ParentStudentConsentError,
  withParentStudentConsentTransaction,
} from '@/lib/bilans/parent-student-consent';
import { NextRequest } from 'next/server';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  prisma: { $transaction: jest.fn() },
}));
jest.mock('@/lib/bilans/parent-student-consent', () => {
  const actual = jest.requireActual('@/lib/bilans/parent-student-consent');
  return {
    ...actual,
    withParentStudentConsentTransaction: jest.fn(),
  };
});

const mockAuth = auth as jest.Mock;
const mockWithConsentTransaction = withParentStudentConsentTransaction as jest.Mock;
const mockGetStatus = jest.fn();
const mockVerify = jest.fn();

const context = {
  params: Promise.resolve({ studentId: 'student-technical-id' }),
};

function request(method: 'GET' | 'POST', body?: unknown, origin?: string): NextRequest {
  const headers = new Headers();
  if (body !== undefined) headers.set('content-type', 'application/json');
  if (origin !== undefined) headers.set('origin', origin);
  return new NextRequest(
    'http://localhost/api/parent/children/student-technical-id/canonical-consent',
    {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    }
  );
}

function useProductionNodeEnv(): () => void {
  const previousDescriptor = Object.getOwnPropertyDescriptor(process.env, 'NODE_ENV');
  Object.defineProperty(process.env, 'NODE_ENV', {
    configurable: true,
    enumerable: true,
    value: 'production',
    writable: true,
  });
  return () => {
    if (previousDescriptor === undefined) {
      Reflect.deleteProperty(process.env, 'NODE_ENV');
      return;
    }
    Object.defineProperty(process.env, 'NODE_ENV', previousDescriptor);
  };
}

describe('/api/parent/children/[studentId]/canonical-consent', () => {
  const transaction = { technical: 'transaction' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: 'parent-user-id', role: 'PARENT' } });
    mockWithConsentTransaction.mockImplementation(
      async (_database: unknown, action: (consentContext: unknown) => unknown) =>
        action({
          transaction,
          preparePending: jest.fn(),
          getStatus: mockGetStatus,
          verify: mockVerify,
        })
    );
  });

  it.each([
    ['session absente', null],
    ['rôle non parent', { user: { id: 'staff-user-id', role: 'ASSISTANTE' } }],
  ])('GET masque en 404 une %s', async (_label, session) => {
    mockAuth.mockResolvedValue(session);

    const response = await GET(request('GET'), context);

    expect(response.status).toBe(404);
    expect(mockWithConsentTransaction).not.toHaveBeenCalled();
  });

  it('GET retourne uniquement l’état scoped du lien possédé', async () => {
    mockGetStatus.mockResolvedValue({ state: 'PENDING_PARENT_CONSENT' });

    const response = await GET(request('GET'), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: 'PENDING_PARENT_CONSENT' });
    expect(mockGetStatus).toHaveBeenCalledWith(expect.objectContaining({
      parentUserId: 'parent-user-id',
      studentId: 'student-technical-id',
      now: expect.any(Date),
    }));
  });

  it('GET masque en 404 un refus d’ownership', async () => {
    mockGetStatus.mockRejectedValue(new ParentStudentConsentError('NOT_FOUND'));

    const response = await GET(request('GET'), context);

    expect(response.status).toBe(404);
  });

  it('POST applique le garde CSRF réel avant le service et toute transaction', async () => {
    const restoreNodeEnv = useProductionNodeEnv();
    try {
      const response = await POST(
        request('POST', { consent: true }, 'https://origine-etrangere.example'),
        context
      );

      expect(response.status).toBe(403);
      expect(mockVerify).not.toHaveBeenCalled();
      expect(mockWithConsentTransaction).not.toHaveBeenCalled();
    } finally {
      restoreNodeEnv();
    }
  });

  it('POST masque en 404 une session absente même avec une origine étrangère', async () => {
    const restoreNodeEnv = useProductionNodeEnv();
    mockAuth.mockResolvedValue(null);
    try {
      const response = await POST(
        request('POST', { consent: true }, 'https://origine-etrangere.example'),
        context
      );

      expect(response.status).toBe(404);
      expect(mockVerify).not.toHaveBeenCalled();
      expect(mockWithConsentTransaction).not.toHaveBeenCalled();
    } finally {
      restoreNodeEnv();
    }
  });

  it.each([
    undefined,
    {},
    { consent: false },
    { consent: true, studentId: 'student-injected' },
  ])('POST refuse un corps autre que strictement { consent: true }', async (body) => {
    const response = await POST(request('POST', body), context);

    expect(response.status).toBe(400);
    expect(mockWithConsentTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['session absente', null],
    ['rôle non parent', { user: { id: 'student-user-id', role: 'ELEVE' } }],
  ])('POST masque en 404 une %s', async (_label, session) => {
    mockAuth.mockResolvedValue(session);

    const response = await POST(request('POST', { consent: true }), context);

    expect(response.status).toBe(404);
    expect(mockWithConsentTransaction).not.toHaveBeenCalled();
  });

  it('POST vérifie le consentement et ne retourne que l’état', async () => {
    mockVerify.mockResolvedValue({
      id: 'link-technical-id',
      state: 'VERIFIED',
      consentedAt: new Date('2026-08-03T10:00:00.000Z'),
      verifiedAt: new Date('2026-08-03T10:00:00.000Z'),
    });

    const response = await POST(request('POST', { consent: true }), context);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ state: 'VERIFIED' });
    expect(mockVerify).toHaveBeenCalledWith(expect.objectContaining({
      parentUserId: 'parent-user-id',
      studentId: 'student-technical-id',
      now: expect.any(Date),
    }));
  });

  it('POST masque en 404 un refus d’ownership', async () => {
    mockVerify.mockRejectedValue(new ParentStudentConsentError('NOT_FOUND'));

    const response = await POST(request('POST', { consent: true }), context);

    expect(response.status).toBe(404);
  });

  it('POST signale en 409 un consentement qui n’est plus en attente', async () => {
    mockVerify.mockRejectedValue(new ParentStudentConsentError('CONSENT_NOT_PENDING'));

    const response = await POST(request('POST', { consent: true }), context);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'CONSENT_NOT_PENDING' });
  });
});
