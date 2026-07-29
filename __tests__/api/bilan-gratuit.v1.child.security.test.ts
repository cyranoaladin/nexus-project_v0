import { NextRequest } from 'next/server';

const RAW_FLOW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const FLOW_TOKEN_HASH = '022639a65546e756623e90f67a4a5f4adf38d8d478b14e9123c64097bd86b9e4';
const REQUEST_ID = 'crequest0000000000000001';
const PARENT_ID = 'cparent000000000000000001';
const STUDENT_ID = 'cstudent00000000000000001';

const mockAuth = jest.fn();
const mockFlowSessionFindFirst = jest.fn();
const mockAttachChild = jest.fn();

jest.mock('@/auth', () => ({ auth: (...args: unknown[]) => mockAuth(...args) }));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: jest.fn(),
    bilanFlowSession: {
      findFirst: (...args: unknown[]) => mockFlowSessionFindFirst(...args),
    },
  },
}));
jest.mock('@/lib/bilans/requests/attach-child', () => ({
  attachChildToNewParent: jest.fn(),
  attachChildToVerifiedRequest: (...args: unknown[]) => mockAttachChild(...args),
}));
jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));

import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { prisma } from '@/lib/prisma';
import { POST } from '@/app/api/bilan-gratuit/v1/requests/current/child/route';

const mockPrisma = prisma as unknown as { $transaction: jest.Mock };
const mockCheckBodySize = checkBodySize as jest.Mock;
const mockCheckCsrf = checkCsrf as jest.Mock;
const mockGuardRateLimitAsync = guardRateLimitAsync as jest.Mock;

function request(
  body: unknown,
  rawBody?: string,
  includeCookie = true,
): NextRequest {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: 'http://localhost:3000',
  };
  if (includeCookie) headers.cookie = `nr_bf_s=${RAW_FLOW_TOKEN}`;
  return new NextRequest(
    'http://localhost:3000/api/bilan-gratuit/v1/requests/current/child',
    {
      method: 'POST',
      headers,
      body: rawBody ?? JSON.stringify(body),
    },
  );
}

describe('POST /api/bilan-gratuit/v1/requests/current/child', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({
      user: {
        id: PARENT_ID,
        email: 'parent@example.com',
        role: 'PARENT',
        bilanRequestId: REQUEST_ID,
      },
    });
    mockFlowSessionFindFirst.mockResolvedValue({ requestId: REQUEST_ID });
    mockAttachChild.mockResolvedValue({ attached: true, studentId: STUDENT_ID });
    mockCheckCsrf.mockReturnValue(null);
    mockCheckBodySize.mockReturnValue(null);
    mockGuardRateLimitAsync.mockResolvedValue(null);
  });

  it('uses the magic-auth session claim on another device without a flow cookie', async () => {
    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
    }, undefined, false));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      next: 'ASSESSMENT',
    });
    expect(mockFlowSessionFindFirst).not.toHaveBeenCalled();
    expect(mockAttachChild).toHaveBeenCalledWith(expect.objectContaining({
      prisma,
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command: {
        action: 'SELECT_EXISTING',
        studentId: STUDENT_ID,
      },
    }));
    expect(JSON.stringify(body)).not.toContain(STUDENT_ID);
    expect(JSON.stringify(body)).not.toContain(REQUEST_ID);
  });

  it('prefers a fresh exact flow cookie over a stale magic-session request claim', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: PARENT_ID,
        email: 'parent@example.com',
        role: 'PARENT',
        bilanRequestId: 'older_request',
      },
    });
    mockFlowSessionFindFirst.mockResolvedValueOnce({ requestId: REQUEST_ID });

    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
    }));

    expect(response.status).toBe(200);
    expect(mockAttachChild).toHaveBeenCalledWith(expect.objectContaining({
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      existingSessionFlowTokenHash: FLOW_TOKEN_HASH,
    }));
  });

  it('supports strict creation of a new inactive child without client identity authority', async () => {
    const command = {
      action: 'CREATE_NEW',
      child: {
        firstName: 'Inès',
        lastName: 'Ben Salah',
        schoolName: 'Lycée Pierre Mendès France',
      },
    };
    const response = await POST(request(command));
    expect(response.status).toBe(200);
    expect(mockAttachChild).toHaveBeenCalledWith(expect.objectContaining({
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      command,
    }));
  });

  it.each([
    ['temporary flow only', null],
    ['wrong role', {
      user: {
        id: PARENT_ID,
        email: 'x@example.com',
        role: 'ELEVE',
        bilanRequestId: REQUEST_ID,
      },
    }],
    ['missing id', {
      user: { email: 'x@example.com', role: 'PARENT', bilanRequestId: REQUEST_ID },
    }],
  ])('denies %s before child access', async (_label, session) => {
    mockAuth.mockResolvedValue(session);
    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Accès refusé.' });
    expect(mockAttachChild).not.toHaveBeenCalled();
  });

  it.each([
    {
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
      parentUserId: 'forged-parent',
    },
    {
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
      requestId: 'forged-request',
    },
    {
      action: 'CREATE_NEW',
      child: { firstName: 'Inès' },
      parentId: 'forged-parent-profile',
    },
    {
      action: 'CREATE_NEW',
      child: { firstName: 'Inès', email: 'child@example.com' },
    },
  ])('rejects client-supplied authoritative identity or unknown fields', async (body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
    expect(mockAttachChild).not.toHaveBeenCalled();
  });

  it('allows a password-authenticated parent to bind the exact live flow-cookie request', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: PARENT_ID,
        email: 'parent@example.com',
        role: 'PARENT',
      },
    });

    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
    }));

    expect(response.status).toBe(200);
    expect(mockFlowSessionFindFirst).toHaveBeenCalledWith({
      where: {
        tokenHash: FLOW_TOKEN_HASH,
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      select: { requestId: true },
    });
    expect(mockAttachChild).toHaveBeenCalledWith(expect.objectContaining({
      requestId: REQUEST_ID,
      parentUserId: PARENT_ID,
      existingSessionFlowTokenHash: FLOW_TOKEN_HASH,
    }));
  });

  it('denies a flow cookie for another parent through the transaction ownership check', async () => {
    mockAuth.mockResolvedValue({
      user: {
        id: PARENT_ID,
        email: 'parent@example.com',
        role: 'PARENT',
      },
    });
    mockFlowSessionFindFirst.mockResolvedValueOnce({ requestId: 'foreign_request' });
    mockAttachChild.mockRejectedValueOnce(
      Object.assign(new Error('denied'), { code: 'BILAN_CHILD_ACCESS_DENIED' }),
    );

    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
    }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Accès refusé.' });
  });

  it('returns the same generic denial for cross-parent child, invalid request state and ambiguity', async () => {
    for (const code of [
      'BILAN_CHILD_ACCESS_DENIED',
      'BILAN_REQUEST_NOT_MUTABLE',
      'BILAN_CHILD_LINK_AMBIGUOUS',
    ]) {
      mockAttachChild.mockRejectedValueOnce(Object.assign(new Error('denied'), { code }));
      const response = await POST(request({
        action: 'SELECT_EXISTING',
        studentId: STUDENT_ID,
      }));
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: 'Accès refusé.' });
    }
  });

  it('applies CSRF, body size and parent-scoped rate limiting before mutation', async () => {
    await POST(request({ action: 'SELECT_EXISTING', studentId: STUDENT_ID }));
    expect(mockCheckCsrf).toHaveBeenCalledTimes(1);
    expect(mockCheckBodySize).toHaveBeenCalledTimes(1);
    expect(mockGuardRateLimitAsync).toHaveBeenCalledWith(expect.any(NextRequest), {
      preset: 'api',
      keySuffix: 'bilan-gratuit-v1-child',
      userId: PARENT_ID,
    });
  });

  it('returns sober 400 for malformed JSON', async () => {
    const response = await POST(request({}, '{'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
  });

  it('requires the server-issued session request binding and never accepts requestId from the body', async () => {
    mockAuth.mockResolvedValue({
      user: { id: PARENT_ID, email: 'x@example.com', role: 'PARENT' },
    });
    mockFlowSessionFindFirst.mockResolvedValue(null);
    const response = await POST(request({
      action: 'SELECT_EXISTING',
      studentId: STUDENT_ID,
      requestId: REQUEST_ID,
    }));
    expect([400, 403]).toContain(response.status);
    expect(mockAttachChild).not.toHaveBeenCalled();
  });
});
