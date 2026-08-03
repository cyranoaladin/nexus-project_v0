import {
  canonicalReportUrl,
  createCanonicalAttempt,
  loadCanonicalReportStatus,
} from '@/lib/bilans/passation/pilot-protocol';

describe('A123 pilot browser protocol', () => {
  test('creates an attempt with the caller idempotency key and no student identity in the body', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      attemptId: 'attempt-1', status: 'DRAFT', startedAt: '2026-08-12T08:00:00.000Z', expiresAt: '2026-08-12T09:00:00.000Z',
    }), { status: 201, headers: { 'content-type': 'application/json' } }));

    await expect(createCanonicalAttempt('entree-premiere-maths-v1', 'pilot-key-123456', fetcher)).resolves.toMatchObject({ attemptId: 'attempt-1' });
    expect(fetcher).toHaveBeenCalledWith('/api/bilans/attempts', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'idempotency-key': 'pilot-key-123456' }),
      body: JSON.stringify({ packSlug: 'entree-premiere-maths-v1' }),
    }));
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/studentId|email|seed/);
  });

  test('loads status and builds stored-artifact URLs without a renderer parameter', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      attemptId: 'attempt-1', status: 'PUBLISHED', reportStatus: 'PUBLISHED',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await expect(loadCanonicalReportStatus('attempt-1', fetcher)).resolves.toMatchObject({ reportStatus: 'PUBLISHED' });
    expect(canonicalReportUrl('attempt-1', 'html')).toBe('/api/bilans/attempts/attempt-1/report?format=html');
    expect(canonicalReportUrl('attempt-1', 'pdf')).toBe('/api/bilans/attempts/attempt-1/report?format=pdf');
  });
});
