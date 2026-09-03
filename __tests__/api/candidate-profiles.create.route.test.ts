jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({
  getCandidateProfileWorkflowStatus: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  createProfilCandidat: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { UserRole } from '@prisma/client';
import { POST } from '@/app/api/assistante/candidate-profiles/route';
import { requireAnyRole } from '@/lib/guards';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import { createProfilCandidat } from '@/lib/quotes/candidate-profile-persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetFlag = getCandidateProfileWorkflowStatus as jest.Mock;
const mockCreate = createProfilCandidat as jest.Mock;

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/assistante/candidate-profiles', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const staffSession = { user: { id: 'staff-1', role: UserRole.ASSISTANTE } };

const validBody = {
  contactLeadId: 'lead-1',
  level: 'TERMINALE',
  examSession: 2027,
  modalite: 'A',
  specialite1: 'MATHEMATIQUES',
  specialite2: 'NSI',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAnyRole.mockResolvedValue(staffSession);
  mockGetFlag.mockResolvedValue('ACTIVE_INTERNAL');
  mockCreate.mockResolvedValue({ id: 'profil-1', ...validBody, createdByUserId: 'staff-1' });
});

describe('POST /api/assistante/candidate-profiles', () => {
  test('requires ADMIN/ASSISTANTE — never trusts a client-supplied role', async () => {
    await POST(makeRequest(validBody));
    expect(mockRequireAnyRole).toHaveBeenCalledWith([UserRole.ADMIN, UserRole.ASSISTANTE]);
  });

  test('returns the guard\'s error response verbatim when auth fails', async () => {
    const denied = new Response(null, { status: 403 });
    mockRequireAnyRole.mockResolvedValueOnce(denied);
    const res = await POST(makeRequest(validBody));
    expect(res).toBe(denied);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('fails closed (403) when the workflow flag is DISABLED — never silently proceeds', async () => {
    mockGetFlag.mockResolvedValueOnce('DISABLED');
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(403);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('rejects invalid JSON with a stable error envelope, never a 500', async () => {
    const req = new NextRequest('http://localhost:3000/api/assistante/candidate-profiles', {
      method: 'POST',
      body: '{not json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty('error');
  });

  test('rejects a payload with an unknown extra field (.strict() schema)', async () => {
    const res = await POST(makeRequest({ ...validBody, monthlyTotal: 999 }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('rejects a payload missing both contactLeadId and studentId', async () => {
    const { contactLeadId, ...rest } = validBody;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('never trusts a client-supplied createdByUserId — always the authenticated staff session id', async () => {
    await POST(makeRequest(validBody));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ createdByUserId: 'staff-1' }));
  });

  test('rejects a payload that tries to inject createdByUserId directly — the .strict() schema has no such field, never silently stripped and trusted', async () => {
    const res = await POST(makeRequest({ ...validBody, createdByUserId: 'someone-else' }));
    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test('on success, returns 201 with the created profile', async () => {
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('profil-1');
  });
});
