jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/persistence.server', () => ({
  transitionQuoteStatus: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/quotes/[id]/send/route';
import { requireAnyRole } from '@/lib/guards';
import { QuoteNotEmittableError } from '@/lib/quotes/emission-guard';
import { transitionQuoteStatus } from '@/lib/quotes/persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockTransition = transitionQuoteStatus as jest.Mock;

function makeRequest(body: unknown = {}) {
  return new NextRequest('http://localhost:3000/api/quotes/quote-1/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/quotes/[id]/send', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects a non-staff caller with the guard\'s own response', async () => {
    mockRequireAnyRole.mockResolvedValue(new Response('forbidden', { status: 403 }));
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(403);
    expect(mockTransition).not.toHaveBeenCalled();
  });

  test('staff (ADMIN/ASSISTANTE) can send, transitions to DEVIS_ENVOYE', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ASSISTANTE' } });
    mockTransition.mockResolvedValue({ status: 'DEVIS_ENVOYE', sentAt: new Date() });
    const res = await POST(makeRequest({ note: 'envoyé par whatsapp' }), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(200);
    expect(mockTransition).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: 'quote-1', toStatus: 'DEVIS_ENVOYE', actorUserId: 'staff-1' }),
    );
  });

  test('an invalid transition (already sent) resolves to 409, not 500', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockTransition.mockRejectedValue(new Error('Invalid quote status transition: INSCRIT -> DEVIS_ENVOYE'));
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(409);
  });

  // ── Lot 5 correctif de sécurité §1/§3 — even a staff caller cannot bypass the emission guard ──

  test('a staff caller cannot send a legacy/incomplete quote — 409, and the response never leaks the internal blocking reasons', async () => {
    mockRequireAnyRole.mockResolvedValue({ user: { id: 'staff-1', role: 'ADMIN' } });
    mockTransition.mockRejectedValue(
      new QuoteNotEmittableError([
        'regulatoryMaturity != CARTE_VALIDATED_DEFINITIVE',
        'profilId missing',
        'snapshotCarte missing or invalid',
      ]),
    );
    const res = await POST(makeRequest(), { params: Promise.resolve({ id: 'quote-1' }) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: 'quote_not_emittable' });
    const bodyText = JSON.stringify(body).toLowerCase();
    for (const leaked of ['regulatorymaturity', 'profilid', 'snapshotcarte', 'snapshotregles']) {
      expect(bodyText).not.toContain(leaked);
    }
  });
});
