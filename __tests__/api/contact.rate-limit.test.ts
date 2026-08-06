import { _resetStoreForTests } from '@/lib/rate-limit';
import { POST } from '@/app/api/contact/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/email/mailer', () => ({
  sendMail: jest.fn().mockResolvedValue({ ok: true, skipped: false }),
}));

const mockCreate = prisma.contactLead.create as jest.Mock;

function makeRequest(body: Record<string, unknown>, ip = '198.51.100.20') {
  return new Request('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/contact rate limiting', () => {
  beforeEach(() => {
    _resetStoreForTests();
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    mockCreate.mockResolvedValue({
      id: 'lead_rate_limit',
      name: 'Alex',
      email: 'alex@example.com',
      phone: null,
      profile: null,
      interest: null,
      urgency: null,
      source: null,
      status: 'NEW',
      notes: null,
      createdAt: new Date('2026-06-13T09:00:00.000Z'),
      updatedAt: new Date('2026-06-13T09:00:00.000Z'),
    });
  });

  it('returns 429 after the public API limit is exceeded', async () => {
    const payload = { name: 'Alex', email: 'alex@example.com', message: 'Bonjour' };

    for (let i = 0; i < 60; i++) {
      const res = await POST(makeRequest({ ...payload, email: `parent-${i}@example.test` }));
      expect(res.status).toBe(200);
    }

    const blocked = await POST(makeRequest({ ...payload, email: 'parent-blocked@example.test' }));
    expect(blocked.status).toBe(429);
    const body = await blocked.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('rejects a non-string email as invalid without touching the real submitter quota', async () => {
    // An attacker sends a malformed, non-string `email` value that String()-coerces
    // to a real submitter's address (a single-element array's toString() equals
    // its element). Five such requests must not consume that address's identity
    // rate-limit bucket.
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makeRequest({ name: 'Attacker', email: ['victim@example.com'], message: 'x' }, '203.0.113.5'),
      );
      expect(res.status).toBe(400);
    }

    // The real victim (different IP, unrelated to the attacker's requests) must
    // still be able to submit — the malformed requests above must not have
    // poisoned/exhausted their identity quota.
    const victimRes = await POST(
      makeRequest({ name: 'Victim', email: 'victim@example.com', message: 'Bonjour' }, '203.0.113.9'),
    );
    expect(victimRes.status).toBe(200);
  });
});
