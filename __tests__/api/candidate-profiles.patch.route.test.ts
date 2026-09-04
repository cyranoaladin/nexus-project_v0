jest.mock('@/lib/guards', () => ({
  requireAnyRole: jest.fn(),
  isErrorResponse: (v: unknown) => v instanceof Response,
}));
jest.mock('@/lib/rate-limit/sensitive', () => ({
  guardSensitiveRateLimit: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/lib/quotes/candidate-profile-flag', () => ({
  getCandidateProfileWorkflowStatus: jest.fn(),
}));
jest.mock('@/lib/quotes/candidate-profile-persistence.server', () => ({
  reviseProfilCandidat: jest.fn(),
  getProfilCandidatById: jest.fn(),
}));

import { NextRequest } from 'next/server';
import { Prisma, UserRole } from '@prisma/client';
import { PATCH } from '@/app/api/assistante/candidate-profiles/[id]/route';
import { requireAnyRole } from '@/lib/guards';
import { getCandidateProfileWorkflowStatus } from '@/lib/quotes/candidate-profile-flag';
import {
  getProfilCandidatById,
  reviseProfilCandidat,
} from '@/lib/quotes/candidate-profile-persistence.server';

const mockRequireAnyRole = requireAnyRole as jest.Mock;
const mockGetWorkflowStatus = getCandidateProfileWorkflowStatus as jest.Mock;
const mockRevise = reviseProfilCandidat as jest.Mock;
const mockGetById = getProfilCandidatById as jest.Mock;

const staffSession = { user: { id: 'staff-1', role: UserRole.ASSISTANTE } };

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/assistante/candidate-profiles/profil-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAnyRole.mockResolvedValue(staffSession);
  mockGetWorkflowStatus.mockResolvedValue('ACTIVE_INTERNAL');
  mockGetById.mockResolvedValue({
    id: 'profil-1',
    level: 'TERMINALE',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'NSI',
    revisionNumber: 1,
  });
  mockRevise.mockResolvedValue({
    id: 'profil-2',
    level: 'TERMINALE',
    specialite1: 'MATHEMATIQUES',
    specialite2: 'PHYSIQUE_CHIMIE',
    revisionNumber: 2,
    previousProfilId: 'profil-1',
  });
});

describe('PATCH /api/assistante/candidate-profiles/[id]', () => {
  test('revises an existing profile with updated fields and returns 200', async () => {
    const res = await PATCH(makeRequest({ specialite2: 'PHYSIQUE_CHIMIE' }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(200);
    expect(mockRevise).toHaveBeenCalledWith('profil-1', {
      specialite2: 'PHYSIQUE_CHIMIE',
      createdByUserId: 'staff-1',
    });
  });

  test('403 when workflow flag is disabled', async () => {
    mockGetWorkflowStatus.mockResolvedValueOnce('OFF');
    const res = await PATCH(makeRequest({ specialite2: 'PHYSIQUE_CHIMIE' }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(403);
    expect(mockRevise).not.toHaveBeenCalled();
  });

  test('400 on invalid payload or unexpected fields (strict schema rejects forged properties)', async () => {
    const res = await PATCH(makeRequest({ forkedField: 'unexpected', ariaAccess: true }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(400);
    expect(mockRevise).not.toHaveBeenCalled();
  });

  test('404 when candidate profile to revise does not exist (P2025)', async () => {
    const p2025 = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
      code: 'P2025',
      clientVersion: '5.x',
    });
    mockRevise.mockRejectedValueOnce(p2025);

    const res = await PATCH(makeRequest({ specialite2: 'PHYSIQUE_CHIMIE' }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(404);
  });

  test('409 when concurrent revision conflict occurs (P2002 on previousProfilId)', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint failed on previousProfilId', {
      code: 'P2002',
      clientVersion: '5.x',
    });
    mockRevise.mockRejectedValueOnce(p2002);

    const res = await PATCH(makeRequest({ specialite2: 'PHYSIQUE_CHIMIE' }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe('candidate_profile_concurrent_revision');
  });

  test('400 when partial PATCH creates duplicate specialities with the existing profile', async () => {
    // existing has specialite1: 'MATHEMATIQUES', payload sets specialite2: 'MATHEMATIQUES'
    const res = await PATCH(makeRequest({ specialite2: 'MATHEMATIQUES' }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('invalid_payload');
    expect(mockRevise).not.toHaveBeenCalled();
  });

  test('accepts p3EligibiliteAudit as an array of audit records', async () => {
    const auditRecord = [
      {
        motif: 'SPORTIF_HAUT_NIVEAU',
        faitsDeclares: true,
        justificatifRequis: true,
        justificatifValide: true,
        decision: 'CONFIRMEE' as const,
        sourceReglementaire: 'Article 3 Arrêté 2018',
      },
    ];
    const res = await PATCH(makeRequest({ p3EligibiliteAudit: auditRecord }), {
      params: Promise.resolve({ id: 'profil-1' }),
    });
    expect(res.status).toBe(200);
    expect(mockRevise).toHaveBeenCalledWith('profil-1', {
      p3EligibiliteAudit: auditRecord,
      createdByUserId: 'staff-1',
    });
  });
});
