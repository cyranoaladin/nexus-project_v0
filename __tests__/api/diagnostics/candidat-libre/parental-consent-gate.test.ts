/**
 * Phase 1 — le consentement parental doit précéder toute collecte.
 *
 * Constat qui motive ce garde-fou : aujourd'hui le dossier est créé sans aucun
 * consentement, les modules sont disponibles immédiatement, et réponses,
 * dépôts et scoring sont persistés avant toute trace de consentement. Le champ
 * `parentConsentAt` était de surcroît alimenté par la question `parent-22`,
 * qui autorise l'exploitation des réponses **du parent** — pas le traitement
 * des données du mineur.
 *
 * Le mécanisme canonique existe déjà et fonctionne sur le bilan gratuit :
 * `canonical_parent_student_links`, état `VERIFIED`. Ce module s'y branche au
 * lieu d'en inventer un second.
 */

const mockGetStatus = jest.fn();
jest.mock('@/lib/bilans/parent-student-consent', () => ({
  createParentStudentConsentContext: () => ({ getStatus: mockGetStatus }),
}));

const mockStudentFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    $transaction: (fn: (tx: unknown) => unknown) => fn({}),
  },
}));

import {
  PARENTAL_CONSENT_REQUIRED_CODE,
  getCandidateDiagnosticConsentState,
  requireVerifiedParentalConsent,
} from '@/lib/diagnostics/candidat-libre/consent-gate.server';

const STUDENT_ID = 'stu_1';

beforeEach(() => {
  jest.clearAllMocks();
  mockStudentFindUnique.mockResolvedValue({
    id: STUDENT_ID,
    parent: { userId: 'usr_parent_1' },
  });
});

describe('getCandidateDiagnosticConsentState', () => {
  it('reports VERIFIED when the canonical link is verified', async () => {
    mockGetStatus.mockResolvedValue({ state: 'VERIFIED' });
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('VERIFIED');
  });

  it.each(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED', 'MISSING'] as const)(
    'passes through the %s state unchanged',
    async (state) => {
      mockGetStatus.mockResolvedValue({ state });
      await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe(state);
    },
  );

  it('reports NO_PARENT when the student has no linked parent account', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: null });
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('NO_PARENT');
    expect(mockGetStatus).not.toHaveBeenCalled();
  });

  it('reports NO_PARENT when the student does not exist', async () => {
    mockStudentFindUnique.mockResolvedValue(null);
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('NO_PARENT');
  });

  it('queries the canonical link with the resolved parent user id', async () => {
    mockGetStatus.mockResolvedValue({ state: 'VERIFIED' });
    await getCandidateDiagnosticConsentState(STUDENT_ID);
    expect(mockGetStatus).toHaveBeenCalledWith(
      expect.objectContaining({ parentUserId: 'usr_parent_1', studentId: STUDENT_ID }),
    );
  });
});

describe('requireVerifiedParentalConsent', () => {
  it('allows collection once consent is VERIFIED', async () => {
    mockGetStatus.mockResolvedValue({ state: 'VERIFIED' });
    await expect(requireVerifiedParentalConsent(STUDENT_ID)).resolves.toBeNull();
  });

  it.each(['PENDING_PARENT_CONSENT', 'REVOKED', 'EXPIRED', 'MISSING'] as const)(
    'blocks collection with 403 when consent is %s',
    async (state) => {
      mockGetStatus.mockResolvedValue({ state });
      const response = await requireVerifiedParentalConsent(STUDENT_ID);
      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);
      const body = await response?.json();
      expect(body.code).toBe(PARENTAL_CONSENT_REQUIRED_CODE);
      expect(body.consentState).toBe(state);
    },
  );

  it('blocks when the student has no parent account at all', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: null });
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(response?.status).toBe(403);
  });

  it('fails closed if the consent lookup throws', async () => {
    mockGetStatus.mockRejectedValue(new Error('db down'));
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(response?.status).toBe(403);
  });

  it('never reveals the parent identity in the blocking response', async () => {
    mockGetStatus.mockResolvedValue({ state: 'MISSING' });
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    const body = JSON.stringify(await response?.json());
    expect(body).not.toContain('usr_parent_1');
  });
});
