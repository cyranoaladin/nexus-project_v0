/**
 * Coach group-plan document route — HTTP status mapping.
 *
 * A renderer-unavailable condition (PDF engine down) is an infrastructure
 * outage, not a client input error. It must not be reported as a 400 —
 * that would make the browser present it as "your request is invalid"
 * when the request was actually fine and the failure is on our side.
 */

jest.mock('@/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/bilans/staff/group-plan-service', () => {
  const actual = jest.requireActual('@/lib/bilans/staff/group-plan-service');
  return {
    ...actual,
    buildStaffGroupPlanDocument: jest.fn(),
  };
});

import { NextRequest } from 'next/server';

import { auth } from '@/auth';
import { GET } from '@/app/dashboard/coach/bilans/group-plan/route';
import { buildStaffGroupPlanDocument, StaffGroupPlanError } from '@/lib/bilans/staff/group-plan-service';

const mockAuth = auth as jest.Mock;
const mockBuild = buildStaffGroupPlanDocument as jest.Mock;

function req(query: string): NextRequest {
  return new NextRequest(`http://localhost/dashboard/coach/bilans/group-plan?${query}`);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'coach-1', role: 'COACH' } });
});

describe('GET /dashboard/coach/bilans/group-plan', () => {
  it('maps a PDF renderer failure to 409 (this codebase\'s established renderer-unavailable status), not 400', async () => {
    // Matches app/api/bilans/attempts/[id]/report — see lib/bilans/api/get-report.ts,
    // which returns 409 with { error: { code: 'REPORT_PDF_UNAVAILABLE' } } when the
    // PDF renderer could not produce a document, instead of 400 (client-input error).
    mockBuild.mockRejectedValue(new StaffGroupPlanError('GROUP_PLAN_PDF_RENDER_FAILED'));

    const response = await GET(req('format=pdf&attemptId=a1&attemptId=a2&attemptId=a3'));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('GROUP_PLAN_PDF_RENDER_FAILED');
  });

  it('still maps NOT_FOUND to 404', async () => {
    mockBuild.mockRejectedValue(new StaffGroupPlanError('NOT_FOUND'));

    const response = await GET(req('format=html&attemptId=a1'));

    expect(response.status).toBe(404);
  });

  it('still maps a validation-style service error (e.g. selection size) to 400', async () => {
    mockBuild.mockRejectedValue(new StaffGroupPlanError('GROUP_SELECTION_MUST_HAVE_3_TO_5_ATTEMPTS'));

    const response = await GET(req('format=html&attemptId=a1'));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('GROUP_SELECTION_MUST_HAVE_3_TO_5_ATTEMPTS');
  });

  it('rejects an invalid format before calling the service', async () => {
    const response = await GET(req('format=xml&attemptId=a1'));

    expect(response.status).toBe(400);
    expect(mockBuild).not.toHaveBeenCalled();
  });

  it('returns 404 when unauthenticated, without calling the service', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await GET(req('format=html&attemptId=a1'));

    expect(response.status).toBe(404);
    expect(mockBuild).not.toHaveBeenCalled();
  });
});
