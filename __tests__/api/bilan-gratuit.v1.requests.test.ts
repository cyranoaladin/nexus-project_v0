import { NextRequest, NextResponse } from 'next/server';

const RAW_FLOW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const FLOW_TOKEN_HASH = '022639a65546e756623e90f67a4a5f4adf38d8d478b14e9123c64097bd86b9e4';
const REQUEST_ID = 'crequest0000000000000001';
const STUDENT_ID = 'cstudent0000000000000001';
const ATTEMPT_ID = 'cattempt0000000000000001';
const COACH_ID = 'ccoach000000000000000001';

const mockCreateBilanRequestIntake = jest.fn();
const mockAuth = jest.fn();
const mockFlowSessionFindUnique = jest.fn();
const mockBilanRequestFindFirst = jest.fn();
const mockSendMail = jest.fn();
const INITIAL_MAGIC_TOKEN = 'NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN';

jest.mock('@/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    bilanFlowSession: {
      findUnique: (...args: unknown[]) => mockFlowSessionFindUnique(...args),
    },
    bilanRequest: {
      findFirst: (...args: unknown[]) => mockBilanRequestFindFirst(...args),
    },
  },
}));
jest.mock('@/lib/bilans/requests/create-request', () => {
  const actual = jest.requireActual('@/lib/bilans/requests/create-request');
  return {
    ...actual,
    createBilanRequestIntake: (...args: unknown[]) => mockCreateBilanRequestIntake(...args),
  };
});
jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/email/mailer', () => ({
  sendMail: (...args: unknown[]) => mockSendMail(...args),
}));
jest.mock('@/lib/bilans/notifications/templates', () => ({
  resolveBilanPublicOrigin: jest.fn(() => 'https://nexusreussite.academy'),
  buildBilanMagicLinkEmail: jest.fn(({ rawToken }: { rawToken: string }) => ({
    subject: 'Reprenez votre bilan',
    html: `<a href="https://nexusreussite.academy/auth/bilan-magic#token=${rawToken}">Continuer</a>`,
    text: `https://nexusreussite.academy/auth/bilan-magic#token=${rawToken}`,
  })),
}));

import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import {
  GET as getCurrentRequest,
} from '@/app/api/bilan-gratuit/v1/requests/current/route';
import {
  POST as createRequest,
} from '@/app/api/bilan-gratuit/v1/requests/route';
import { POST as compatibilityIntake } from '@/app/api/bilan-gratuit/route';

const mockGuardRateLimitAsync = guardRateLimitAsync as jest.Mock;
const mockCheckCsrf = checkCsrf as jest.Mock;
const mockCheckBodySize = checkBodySize as jest.Mock;

const admission = {
  parent: {
    firstName: 'Amel',
    lastName: 'Ben Salah',
    email: 'amel@example.com',
    phone: '+21699192829',
  },
  child: {
    firstName: 'Inès',
    lastName: 'Ben Salah',
    schoolName: 'Lycée Pierre Mendès France',
  },
  schoolYear: '2026-2027',
  level: 'TERMINALE',
  subject: 'MATHEMATIQUES',
  mainNeed: 'Structurer les révisions et consolider les automatismes.',
  consent: true,
  consentVersion: 'bilan-public-v1',
};

function post(
  body: unknown,
  options: Readonly<{
    rawBody?: string;
    idempotencyKey?: string | null;
    contentLength?: string;
  }> = {},
): NextRequest {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  });
  if (options.idempotencyKey !== null) {
    headers.set('idempotency-key', options.idempotencyKey ?? 'request-key-1234567890');
  }
  if (options.contentLength) headers.set('content-length', options.contentLength);

  return new NextRequest('http://localhost:3000/api/bilan-gratuit/v1/requests', {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  });
}

function getCurrent(cookie?: string): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/bilan-gratuit/v1/requests/current',
    { headers: cookie ? { cookie } : undefined },
  );
}

describe('POST /api/bilan-gratuit/v1/requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuardRateLimitAsync.mockResolvedValue(null);
    mockCheckCsrf.mockReturnValue(null);
    mockCheckBodySize.mockReturnValue(null);
    mockSendMail.mockResolvedValue({ ok: true, messageId: 'safe-id' });
    mockCreateBilanRequestIntake.mockResolvedValue({
      public: {
        success: true,
        message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
        next: 'ASSESSMENT_OR_EMAIL',
      },
      internal: {
        requestId: REQUEST_ID,
        replayed: false,
        flowSessionToken: {
          rawToken: RAW_FLOW_TOKEN,
          tokenHash: FLOW_TOKEN_HASH,
          expiresAt: new Date('2026-07-29T12:30:00.000Z'),
          cookie: {
            name: 'nr_bf_s',
            value: RAW_FLOW_TOKEN,
            options: {
              httpOnly: true,
              sameSite: 'lax',
              secure: false,
              path: '/api/bilan-gratuit',
              maxAge: 1_800,
            },
          },
        },
        magicLinkToken: {
          rawToken: INITIAL_MAGIC_TOKEN,
          tokenHash: 'f'.repeat(64),
          expiresAt: new Date('2026-07-29T12:15:00.000Z'),
        },
      },
    });
  });

  afterEach(() => {
    delete process.env.BILAN_CANONICAL_INTAKE_ENABLED;
  });

  it('uses strict guards, a required bounded header idempotency key and the intake service', async () => {
    const response = await createRequest(post(admission));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(mockCheckCsrf).toHaveBeenCalledTimes(1);
    expect(mockCheckBodySize).toHaveBeenCalledTimes(1);
    expect(mockGuardRateLimitAsync).toHaveBeenCalledWith(expect.any(NextRequest), {
      preset: 'api',
      keySuffix: 'bilan-gratuit-v1-intake',
      requireDistributed: true,
    });
    expect(mockCreateBilanRequestIntake).toHaveBeenCalledWith(expect.objectContaining({
      admission,
      idempotencyKey: 'request-key-1234567890',
      production: false,
    }));
    expect(JSON.stringify(body)).not.toContain(REQUEST_ID);
  });

  it('sets the HttpOnly flow cookie only for a non-replayed creation', async () => {
    const response = await createRequest(post(admission));

    expect(response.headers.get('set-cookie')).toContain(`nr_bf_s=${RAW_FLOW_TOKEN}`);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
    expect(response.headers.get('set-cookie')).toContain('Path=/api/bilan-gratuit');

    mockCreateBilanRequestIntake.mockResolvedValueOnce({
      ...(await mockCreateBilanRequestIntake.mock.results[0].value),
      public: {
        success: true,
        message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
        next: 'ASSESSMENT_OR_EMAIL',
      },
      internal: {
        requestId: REQUEST_ID,
        replayed: true,
        flowSessionToken: null,
        magicLinkToken: null,
      },
    });
    const replay = await createRequest(post(admission));
    expect(replay.headers.get('set-cookie')).toBeNull();
    expect(await replay.json()).toEqual(await response.clone().json());
  });

  it('sends the initial magic link without exposing token, request identity or PII', async () => {
    const response = await createRequest(post(admission));
    const body = await response.json();

    expect(mockSendMail).toHaveBeenCalledWith({
      to: admission.parent.email,
      subject: 'Reprenez votre bilan',
      html: expect.stringContaining(`#token=${INITIAL_MAGIC_TOKEN}`),
      text: expect.stringContaining(`#token=${INITIAL_MAGIC_TOKEN}`),
    });
    expect(JSON.stringify(body)).not.toContain(INITIAL_MAGIC_TOKEN);
    expect(JSON.stringify(body)).not.toContain(REQUEST_ID);
    expect(JSON.stringify(body)).not.toContain(admission.parent.email);
  });

  it('keeps the identical success contract and logs no token or PII if initial SMTP fails', async () => {
    mockSendMail.mockRejectedValueOnce(
      new Error(`smtp failed ${INITIAL_MAGIC_TOKEN} ${admission.parent.email}`),
    );
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await createRequest(post(admission));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
      next: 'ASSESSMENT_OR_EMAIL',
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(INITIAL_MAGIC_TOKEN);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(admission.parent.email);
    consoleError.mockRestore();
  });

  it('does not resend an initial magic link on idempotent replay', async () => {
    mockCreateBilanRequestIntake.mockResolvedValueOnce({
      public: {
        success: true,
        message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
        next: 'ASSESSMENT_OR_EMAIL',
      },
      internal: {
        requestId: REQUEST_ID,
        replayed: true,
        flowSessionToken: null,
        magicLinkToken: null,
      },
    });
    await createRequest(post(admission));
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it.each([
    ['missing', null],
    ['too short', 'short'],
    ['too long', 'a'.repeat(129)],
    ['invalid characters', 'valid-length-but spaces'],
  ])('rejects a %s idempotency header before intake', async (_label, key) => {
    const response = await createRequest(post(admission, { idempotencyKey: key }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
    expect(mockCreateBilanRequestIntake).not.toHaveBeenCalled();
  });

  it.each([
    ['unknown root field', { ...admission, parentUserId: 'forged-parent' }],
    ['unknown nested field', {
      ...admission,
      parent: { ...admission.parent, requestId: 'forged-request' },
    }],
    ['false consent', { ...admission, consent: false }],
  ])('rejects strict schema violations: %s', async (_label, body) => {
    const response = await createRequest(post(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
    expect(mockCreateBilanRequestIntake).not.toHaveBeenCalled();
  });

  it('returns a sober 400 for malformed JSON', async () => {
    const privateMarker = 'minor.parent@example.com';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await createRequest(post({}, {
      rawBody: `{"email":"${privateMarker}"`,
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(privateMarker);
    consoleError.mockRestore();
  });

  it('rejects an under-declared actual body over one megabyte before intake', async () => {
    const response = await createRequest(post(
      {},
      {
        rawBody: JSON.stringify({
          ...admission,
          padding: 'x'.repeat(1024 * 1024),
        }),
        contentLength: '64',
      },
    ));
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: 'Payload too large' });
    expect(mockCreateBilanRequestIntake).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns the guard response before parsing or persistence', async () => {
    const blocked = NextResponse.json({ error: 'Requête refusée.' }, { status: 413 });
    mockCheckBodySize.mockReturnValueOnce(blocked);
    const response = await createRequest(post(admission));
    expect(response).toBe(blocked);
    expect(mockGuardRateLimitAsync).not.toHaveBeenCalled();
    expect(mockCreateBilanRequestIntake).not.toHaveBeenCalled();
  });

  it.each(['website', 'url', 'honeypot'])(
    'returns neutral fake success for a filled %s honeypot without intake',
    async (field) => {
      const response = await createRequest(post({ ...admission, [field]: 'bot-value' }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        success: true,
        message: 'Votre demande a bien été enregistrée. Consultez votre email pour poursuivre.',
        next: 'ASSESSMENT_OR_EMAIL',
      });
      expect(mockCreateBilanRequestIntake).not.toHaveBeenCalled();
      expect(response.headers.get('set-cookie')).toBeNull();
    },
  );

  it('delegates the compatibility endpoint only when the canonical flag is enabled', async () => {
    process.env.BILAN_CANONICAL_INTAKE_ENABLED = 'true';
    const response = await compatibilityIntake(post(admission));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`nr_bf_s=${RAW_FLOW_TOKEN}`);
    expect(mockCreateBilanRequestIntake).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/bilan-gratuit/v1/requests/current', () => {
  const safeRequest = {
    id: REQUEST_ID,
    status: 'NEW',
    accountVerificationState: 'VERIFICATION_PENDING',
    subject: 'MATHEMATIQUES',
    gradeLevel: 'TERMINALE',
    schoolYear: '2026-2027',
    studentId: STUDENT_ID,
    canonicalAttemptId: ATTEMPT_ID,
    assignedCoachId: COACH_ID,
    createdAt: new Date('2026-07-29T12:00:00.000Z'),
    updatedAt: new Date('2026-07-29T12:00:00.000Z'),
    lastActivityAt: new Date('2026-07-29T12:00:00.000Z'),
    submittedAt: null,
    reviewedAt: null,
    publishedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue(null);
    mockFlowSessionFindUnique.mockResolvedValue({ requestId: REQUEST_ID });
    mockBilanRequestFindFirst.mockResolvedValue(safeRequest);
  });

  it('resolves only the exact live flow cookie hash and returns a safe no-store projection', async () => {
    const response = await getCurrentRequest(getCurrent(`nr_bf_s=${RAW_FLOW_TOKEN}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ request: {
      resumeAvailable: true,
      next: 'VERIFY_PARENT_ACCOUNT',
    } });
    for (const forbidden of [
      'id',
      'requestId',
      'studentId',
      'canonicalAttemptId',
      'assignedCoachId',
      REQUEST_ID,
      STUDENT_ID,
      ATTEMPT_ID,
      COACH_ID,
    ]) {
      expect(JSON.stringify(body)).not.toContain(forbidden);
    }
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mockFlowSessionFindUnique).toHaveBeenCalledWith({
      where: { tokenHash: FLOW_TOKEN_HASH },
      select: { requestId: true },
    });
    expect(mockBilanRequestFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: REQUEST_ID,
        flowSessions: {
          some: {
            tokenHash: FLOW_TOKEN_HASH,
            revokedAt: null,
            expiresAt: { gt: expect.any(Date) },
          },
        },
      },
    }));
    const serialized = JSON.stringify(mockBilanRequestFindFirst.mock.calls[0][0]);
    expect(serialized).not.toContain('mainNeed');
    expect(serialized).not.toContain('message');
    expect(serialized).not.toContain('provisionalChild');
    expect(serialized).not.toContain('parentUser');
  });

  it('makes new-account, existing-parent and role-conflict temporary flows publicly indistinguishable', async () => {
    const internalVariants = [
      {
        ...safeRequest,
        status: 'NEW',
        accountVerificationState: 'VERIFICATION_PENDING',
        studentId: STUDENT_ID,
      },
      {
        ...safeRequest,
        status: 'NEW',
        accountVerificationState: 'VERIFICATION_PENDING',
        studentId: null,
      },
      {
        ...safeRequest,
        status: 'HUMAN_FOLLOWUP_REQUIRED',
        accountVerificationState: 'UNVERIFIED',
        studentId: null,
      },
    ];
    const publicBodies = [];

    for (const internalRequest of internalVariants) {
      mockBilanRequestFindFirst.mockResolvedValueOnce(internalRequest);
      const response = await getCurrentRequest(getCurrent(`nr_bf_s=${RAW_FLOW_TOKEN}`));
      expect(response.status).toBe(200);
      publicBodies.push(await response.json());
    }

    expect(publicBodies).toEqual([
      { request: { resumeAvailable: true, next: 'VERIFY_PARENT_ACCOUNT' } },
      { request: { resumeAvailable: true, next: 'VERIFY_PARENT_ACCOUNT' } },
      { request: { resumeAvailable: true, next: 'VERIFY_PARENT_ACCOUNT' } },
    ]);
    const serialized = JSON.stringify(publicBodies);
    expect(serialized).not.toMatch(
      /studentId|hasChild|status|accountVerificationState|HUMAN_FOLLOWUP_REQUIRED|UNVERIFIED/,
    );
    expect(serialized).not.toContain(STUDENT_ID);
  });

  it.each([
    ['missing cookie', undefined],
    ['malformed cookie', 'nr_bf_s=not-a-canonical-token'],
  ])('denies a %s with the same non-enumerable contract', async (_label, cookie) => {
    const response = await getCurrentRequest(getCurrent(cookie));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Dossier indisponible.' });
  });

  it('denies expired, revoked and cross-request flow sessions identically', async () => {
    mockFlowSessionFindUnique.mockResolvedValueOnce({ requestId: 'foreign_request' });
    mockBilanRequestFindFirst.mockResolvedValueOnce(null);
    const response = await getCurrentRequest(getCurrent(`nr_bf_s=${RAW_FLOW_TOKEN}`));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Dossier indisponible.' });
  });

  it('never selects the latest request from a parent session without a request-bound cookie', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'parent_1', email: 'parent@example.com', role: 'PARENT' },
    });
    const response = await getCurrentRequest(getCurrent());
    expect(response.status).toBe(404);
    expect(mockFlowSessionFindUnique).not.toHaveBeenCalled();
    expect(mockBilanRequestFindFirst).not.toHaveBeenCalled();
  });

  it('resumes on another device from the server-issued request-bound session claim', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'parent_1',
        email: 'parent@example.com',
        role: 'PARENT',
        bilanRequestId: REQUEST_ID,
      },
    });
    mockBilanRequestFindFirst.mockResolvedValueOnce({
      ...safeRequest,
      accountVerificationState: 'VERIFIED',
    });
    const response = await getCurrentRequest(getCurrent());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ request: {
      status: 'NEW',
      accountVerificationState: 'VERIFIED',
      subject: 'MATHEMATIQUES',
      gradeLevel: 'TERMINALE',
      schoolYear: '2026-2027',
      hasChild: true,
      hasAssessment: true,
      lastActivityAt: safeRequest.lastActivityAt.toISOString(),
      submittedAt: null,
      publishedAt: null,
    } });
    for (const forbidden of [
      'id',
      'requestId',
      'studentId',
      'canonicalAttemptId',
      'assignedCoachId',
      REQUEST_ID,
      STUDENT_ID,
      ATTEMPT_ID,
      COACH_ID,
    ]) {
      expect(JSON.stringify(body)).not.toContain(forbidden);
    }
    expect(mockFlowSessionFindUnique).not.toHaveBeenCalled();
    expect(mockBilanRequestFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: REQUEST_ID,
        parentUserId: 'parent_1',
        accountVerificationState: 'VERIFIED',
      }),
    }));
  });

  it('denies a cross-request or stale session claim through the ownership query', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: 'parent_1',
        email: 'parent@example.com',
        role: 'PARENT',
        bilanRequestId: 'request_foreign',
      },
    });
    mockBilanRequestFindFirst.mockResolvedValueOnce(null);
    const response = await getCurrentRequest(getCurrent());
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Dossier indisponible.' });
  });
});
