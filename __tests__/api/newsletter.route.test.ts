import { _resetStoreForTests } from '@/lib/rate-limit';
import { POST } from '@/app/api/newsletter/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/email/outbox', () => ({
  enqueueEmailIntent: jest.fn().mockResolvedValue({ id: 'job-1' }),
}));
jest.mock('@/lib/email/outbox-scheduler', () => ({
  kickEmailOutboxDrain: jest.fn(),
}));

const mockCreate = prisma.contactLead.create as jest.Mock;

function makeRequest(body: Record<string, unknown>, ip = '198.51.100.40') {
  return new Request('http://localhost:3000/api/newsletter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/newsletter identity rate-limit', () => {
  beforeEach(() => {
    _resetStoreForTests();
    jest.clearAllMocks();
    delete process.env.RATE_LIMIT_DISABLE;
    delete process.env.REDIS_URL;
    mockCreate.mockResolvedValue({
      id: 'lead_1',
      name: 'Newsletter',
      email: 'victim@example.com',
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

  it('rejects a non-string email as invalid without touching the real subscriber quota', async () => {
    // An attacker sends a malformed, non-string `email` value that String()-coerces
    // to a real subscriber's address (a single-element array's toString() equals
    // its element). Five such requests must not consume that address's identity
    // rate-limit bucket.
    for (let i = 0; i < 5; i++) {
      const res = await POST(
        makeRequest({ email: ['victim@example.com'], name: 'Attacker', consent: true }, '203.0.113.5'),
      );
      expect(res.status).toBe(400);
    }

    // The real victim (different IP, unrelated to the attacker's requests) must
    // still be able to subscribe — the malformed requests above must not have
    // poisoned/exhausted their identity quota.
    const victimRes = await POST(
      makeRequest({ email: 'victim@example.com', name: 'Victim', consent: true }, '203.0.113.9'),
    );
    expect(victimRes.status).toBe(200);
  });

  it('returns 400 (not 500) when email is a non-string object with a non-callable toString', async () => {
    const res = await POST(
      makeRequest({ email: { toString: 'nope' }, name: 'Attacker', consent: true }, '203.0.113.20'),
    );
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe('invalid_payload');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
