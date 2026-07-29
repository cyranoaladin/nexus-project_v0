import { NextRequest } from 'next/server';

const RAW_TOKEN = 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM';
const TOKEN_HASH = '022639a65546e756623e90f67a4a5f4adf38d8d478b14e9123c64097bd86b9e4';
const EXPIRES_AT = new Date('2026-07-29T12:15:00.000Z');
const PARENT_ID = 'cparent000000000000000001';
const REQUEST_ID = 'crequest0000000000000001';
const NOW = new Date('2026-07-29T12:00:00.000Z');

const mockTransaction = {
  user: {
    findMany: jest.fn(),
  },
  bilanRequest: {
    findFirst: jest.fn(),
  },
  bilanMagicLink: {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    create: jest.fn().mockResolvedValue({ id: 'cmagiclk0000000000000001' }),
  },
  bilanRequestEvent: {
    create: jest.fn().mockResolvedValue({ id: 'cevent000000000000000001' }),
  },
};
jest.mock('@/lib/prisma', () => ({ prisma: { $transaction: jest.fn() } }));
jest.mock('@/lib/rate-limit', () => ({
  guardRateLimitAsync: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/csrf', () => ({
  checkCsrf: jest.fn().mockReturnValue(null),
  checkBodySize: jest.fn().mockReturnValue(null),
}));
jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true, messageId: 'safe-id' }),
}));
jest.mock('@/lib/bilans/requests/tokens', () => ({
  createBilanMagicLinkToken: () => ({
    rawToken: 'MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM',
    tokenHash: '022639a65546e756623e90f67a4a5f4adf38d8d478b14e9123c64097bd86b9e4',
    expiresAt: new Date('2026-07-29T12:15:00.000Z'),
  }),
  hashBilanToken: jest.fn(),
}));

import { checkBodySize, checkCsrf } from '@/lib/csrf';
import { sendMail } from '@/lib/email/mailer';
import { prisma } from '@/lib/prisma';
import { guardRateLimitAsync } from '@/lib/rate-limit';
import { POST } from '@/app/api/auth/bilan-magic/request/route';

const mockCheckBodySize = checkBodySize as jest.Mock;
const mockCheckCsrf = checkCsrf as jest.Mock;
const mockSendMail = sendMail as jest.Mock;
const mockPrisma = prisma as unknown as { $transaction: jest.Mock };
const mockGuardRateLimitAsync = guardRateLimitAsync as jest.Mock;

function request(body: unknown, rawBody?: string): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/bilan-magic/request', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'http://localhost:3000',
    },
    body: rawBody ?? JSON.stringify(body),
  });
}

async function responseContract(body: unknown) {
  const response = await POST(request(body));
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe('POST /api/auth/bilan-magic/request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(NOW);
    mockPrisma.$transaction.mockImplementation(
      async (callback: (client: typeof mockTransaction) => unknown) =>
        callback(mockTransaction),
    );
    mockGuardRateLimitAsync.mockResolvedValue(null);
    mockCheckCsrf.mockReturnValue(null);
    mockCheckBodySize.mockReturnValue(null);
    mockTransaction.user.findMany.mockResolvedValue([{
      id: PARENT_ID,
      email: 'Registered.Parent@Example.com',
      role: 'PARENT',
    }]);
    mockTransaction.bilanRequest.findFirst.mockResolvedValue({ id: REQUEST_ID });
    mockTransaction.bilanMagicLink.updateMany.mockResolvedValue({ count: 1 });
    mockTransaction.bilanMagicLink.create.mockResolvedValue({ id: 'cmagiclk0000000000000001' });
    mockTransaction.bilanRequestEvent.create.mockResolvedValue({ id: 'cevent000000000000000001' });
    mockSendMail.mockResolvedValue({ ok: true, messageId: 'safe-id' });
    process.env.NEXTAUTH_URL = 'https://nexusreussite.academy';
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.NEXTAUTH_URL;
  });

  it('normalizes email, rotates links transactionally and sends only to the registered address', async () => {
    const contract = await responseContract({ email: '  REGISTERED.parent@example.COM ' });

    expect(contract).toEqual({
      status: 200,
      body: {
        success: true,
        message: 'Si une demande éligible existe, un lien de connexion a été envoyé.',
      },
    });
    expect(mockTransaction.user.findMany).toHaveBeenCalledWith({
      where: {
        email: {
          equals: 'registered.parent@example.com',
          mode: 'insensitive',
        },
      },
      select: { id: true, email: true, role: true },
      take: 2,
    });
    expect(mockTransaction.bilanMagicLink.updateMany).toHaveBeenCalledWith({
      where: {
        requestId: REQUEST_ID,
        parentUserId: PARENT_ID,
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: NOW },
    });
    expect(mockTransaction.bilanMagicLink.create).toHaveBeenCalledWith({
      data: {
        requestId: REQUEST_ID,
        parentUserId: PARENT_ID,
        tokenHash: TOKEN_HASH,
        expiresAt: EXPIRES_AT,
      },
      select: { id: true },
    });
    expect(mockTransaction.bilanRequestEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: REQUEST_ID,
        type: 'ACCOUNT_VERIFICATION_REQUESTED',
        actor: 'SYSTEM',
        payload: { deliveryChannelCode: 'EMAIL' },
        occurredAt: NOW,
      }),
    });
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'Registered.Parent@Example.com',
      html: expect.stringContaining(
        `https://nexusreussite.academy/auth/bilan-magic#token=${RAW_TOKEN}`,
      ),
      text: expect.stringContaining(
        `https://nexusreussite.academy/auth/bilan-magic#token=${RAW_TOKEN}`,
      ),
    }));
    const serializedMail = JSON.stringify(mockSendMail.mock.calls[0][0]);
    expect(serializedMail).not.toContain('?token=');
    expect(serializedMail).not.toContain(REQUEST_ID);
    expect(serializedMail).not.toContain('email=');
    expect(JSON.stringify(contract)).not.toContain(RAW_TOKEN);
  });

  it.each([
    ['absent account', []],
    ['non-parent role', [{ id: PARENT_ID, email: 'role@example.com', role: 'ELEVE' }]],
    ['case collision', [
      { id: PARENT_ID, email: 'Case@example.com', role: 'PARENT' },
      { id: 'cparent000000000000000002', email: 'case@example.com', role: 'PARENT' },
    ]],
  ])('returns the identical neutral contract for an %s', async (_label, users) => {
    mockTransaction.user.findMany.mockResolvedValue(users);

    await expect(responseContract({ email: 'case@example.com' })).resolves.toEqual({
      status: 200,
      body: {
        success: true,
        message: 'Si une demande éligible existe, un lien de connexion a été envoyé.',
      },
    });
    expect(mockTransaction.bilanMagicLink.create).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('returns the same neutral response when no pending request exists', async () => {
    mockTransaction.bilanRequest.findFirst.mockResolvedValue(null);

    await expect(responseContract({ email: 'registered.parent@example.com' })).resolves.toEqual({
      status: 200,
      body: {
        success: true,
        message: 'Si une demande éligible existe, un lien de connexion a été envoyé.',
      },
    });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('does not enumerate eligibility when SMTP fails and exposes no token in logs or response', async () => {
    mockSendMail.mockRejectedValue(new Error(`smtp rejected ${RAW_TOKEN}`));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const contract = await responseContract({ email: 'registered.parent@example.com' });

    expect(contract).toEqual({
      status: 200,
      body: {
        success: true,
        message: 'Si une demande éligible existe, un lien de connexion a été envoyé.',
      },
    });
    expect(JSON.stringify(contract)).not.toContain(RAW_TOKEN);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain(RAW_TOKEN);
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('registered.parent');
    consoleError.mockRestore();
  });

  it.each([
    [{ email: 'invalid' }],
    [{ email: 'valid@example.com', requestId: REQUEST_ID }],
    [{}],
  ])('rejects invalid or extra input with a sober 400 response', async (body) => {
    const contract = await responseContract(body);

    expect(contract).toEqual({
      status: 400,
      body: { error: 'Adresse email invalide.' },
    });
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON without an internal error', async () => {
    const response = await POST(request({}, '{'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Requête invalide.' });
  });

  it('applies the existing CSRF, body-size and public auth rate-limit guards', async () => {
    await POST(request({ email: 'registered.parent@example.com' }));

    expect(mockCheckCsrf).toHaveBeenCalledTimes(1);
    expect(mockCheckBodySize).toHaveBeenCalledTimes(1);
    expect(mockGuardRateLimitAsync).toHaveBeenCalledWith(
      expect.any(NextRequest),
      { preset: 'auth', keySuffix: 'bilan-magic-request' },
    );
  });
});
