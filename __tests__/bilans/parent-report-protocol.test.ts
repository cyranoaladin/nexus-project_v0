import {
  loadParentCanonicalReports,
  parentCanonicalReportUrl,
} from '@/lib/bilans/passation/parent-report-protocol';

describe('P0-C Parent report browser protocol', () => {
  test('loads only the dedicated Parent status route', async () => {
    const fetcher = jest.fn(async () => new Response(JSON.stringify({
      studentId: 'student-a1',
      bilans: [{
        attemptId: 'attempt-a1', level: 'SECONDE', subject: 'MATHS',
        title: 'Mathématiques · Seconde', status: 'SUBMITTED',
        updatedAt: '2026-08-04T08:00:00.000Z', reportAvailable: false,
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    await expect(loadParentCanonicalReports('student-a1', fetcher)).resolves.toMatchObject({
      bilans: [{ status: 'SUBMITTED', reportAvailable: false }],
    });
    expect(fetcher).toHaveBeenCalledWith(
      '/api/parent/children/student-a1/bilans',
      { cache: 'no-store' },
    );
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/\/api\/student\//);
  });

  test('builds dedicated Parent HTML and PDF URLs', () => {
    expect(parentCanonicalReportUrl('student-a1', 'attempt-a1', 'html')).toBe(
      '/api/parent/children/student-a1/bilans/attempt-a1/report?format=html',
    );
    expect(parentCanonicalReportUrl('student-a1', 'attempt-a1', 'pdf')).toBe(
      '/api/parent/children/student-a1/bilans/attempt-a1/report?format=pdf',
    );
  });

  test('fails closed on an invalid or cross-child payload', async () => {
    const fetcher = async () => new Response(JSON.stringify({
      studentId: 'student-b1', bilans: [], internal: '__INTERNAL_CHANNEL__',
    }), { status: 200, headers: { 'content-type': 'application/json' } });

    await expect(loadParentCanonicalReports('student-a1', fetcher)).rejects.toThrow(
      'PARENT_CANONICAL_REPORTS_INVALID_RESPONSE',
    );
  });
});
