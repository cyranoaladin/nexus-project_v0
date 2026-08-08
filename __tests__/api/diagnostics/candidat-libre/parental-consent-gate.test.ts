/**
 * Phase 1 — le consentement parental doit précéder toute collecte, et il doit
 * être **spécifique au candidat libre**.
 *
 * Décision de la direction : ce consentement ne réutilise pas le rattachement
 * parent-élève du bilan gratuit. La notice décrit le diagnostic, le dépôt de
 * documents officiels et un enregistrement audio — trois traitements qui
 * n'existent pas dans le bilan gratuit. S'appuyer sur l'autre rattachement
 * reviendrait à traiter les données d'un mineur sur la foi d'un consentement
 * donné pour autre chose.
 *
 * Le consentement porte donc sur une **version de notice** précise, et il est
 * **retirable** : un retrait bloque le traitement et déclenche l'effacement.
 */

const mockConsentFindFirst = jest.fn();
const mockStudentFindUnique = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: (...args: unknown[]) => mockStudentFindUnique(...args) },
    candidateDiagnosticConsent: {
      findFirst: (...args: unknown[]) => mockConsentFindFirst(...args),
    },
  },
}));

import {
  PARENTAL_CONSENT_REQUIRED_CODE,
  getCandidateDiagnosticConsentState,
  requireVerifiedParentalConsent,
} from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from '@/lib/diagnostics/candidat-libre/privacy-notice';

const STUDENT_ID = 'stu_1';

function consentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'consent_1',
    studentId: STUDENT_ID,
    parentUserId: 'usr_parent_1',
    noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    parentConsentedAt: new Date('2026-08-08T09:00:00Z'),
    studentAssentedAt: new Date('2026-08-08T09:05:00Z'),
    withdrawnAt: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: { userId: 'usr_parent_1' } });
  mockConsentFindFirst.mockResolvedValue(consentRow());
});

describe('getCandidateDiagnosticConsentState', () => {
  it('is GRANTED when a current, non-withdrawn consent exists', async () => {
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('GRANTED');
  });

  it('is MISSING when no consent was ever recorded', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('MISSING');
  });

  it('is WITHDRAWN once the parent withdraws', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: new Date() }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('WITHDRAWN');
  });

  it('is OUTDATED_NOTICE when the consented notice version is no longer current', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ noticeVersion: 'candidat-libre-notice.v0' }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('OUTDATED_NOTICE');
  });

  it('is STUDENT_ASSENT_MISSING when only the parent has consented', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ studentAssentedAt: null }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('STUDENT_ASSENT_MISSING');
  });

  it('is NO_PARENT when the student has no linked parent account', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: null });
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('NO_PARENT');
    expect(mockConsentFindFirst).not.toHaveBeenCalled();
  });

  it('rejects a consent recorded by someone other than the linked parent', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ parentUserId: 'usr_someone_else' }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('MISSING');
  });

  it('never consults the bilan gratuit parent-student link', async () => {
    await getCandidateDiagnosticConsentState(STUDENT_ID);
    const queried = JSON.stringify(mockConsentFindFirst.mock.calls);
    expect(queried).not.toContain('parentStudentLink');
    expect(mockConsentFindFirst).toHaveBeenCalled();
  });
});

describe('requireVerifiedParentalConsent', () => {
  it('allows collection once consent is GRANTED', async () => {
    await expect(requireVerifiedParentalConsent(STUDENT_ID)).resolves.toBeNull();
  });

  it.each([
    ['MISSING', () => mockConsentFindFirst.mockResolvedValue(null)],
    ['WITHDRAWN', () => mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: new Date() }))],
    ['OUTDATED_NOTICE', () => mockConsentFindFirst.mockResolvedValue(consentRow({ noticeVersion: 'v0' }))],
    ['STUDENT_ASSENT_MISSING', () => mockConsentFindFirst.mockResolvedValue(consentRow({ studentAssentedAt: null }))],
  ])('blocks collection with 403 when consent is %s', async (state, arrange) => {
    arrange();
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.code).toBe(PARENTAL_CONSENT_REQUIRED_CODE);
    expect(body.consentState).toBe(state);
    expect(body.noticeVersion).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
  });

  it('fails closed if the consent lookup throws', async () => {
    mockConsentFindFirst.mockRejectedValue(new Error('db down'));
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(response?.status).toBe(403);
  });

  it('never reveals the parent identity in the blocking response', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(JSON.stringify(await response?.json())).not.toContain('usr_parent_1');
  });
});
