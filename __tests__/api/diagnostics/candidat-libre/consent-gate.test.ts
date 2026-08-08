/**
 * Garde-fou de consentement — étudiant majeur.
 *
 * C'est le consentement de l'étudiant qui autorise le traitement : il est
 * adulte, ces données sont les siennes. Le lien parental subsiste pour la
 * structure du dossier et ne conditionne plus rien.
 *
 * Le consentement porte sur une version de notice précise et reste retirable ;
 * un retrait bloque immédiatement.
 */

const mockConsentFindFirst = jest.fn();
jest.mock('@/lib/prisma', () => ({
  prisma: {
    candidateDiagnosticConsent: {
      findFirst: (...args: unknown[]) => mockConsentFindFirst(...args),
    },
  },
}));

import {
  CONSENT_REQUIRED_CODE,
  getCandidateDiagnosticConsentState,
  requireVerifiedParentalConsent,
} from '@/lib/diagnostics/candidat-libre/consent-gate.server';
import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from '@/lib/diagnostics/candidat-libre/privacy-notice';

const STUDENT_ID = 'stu_1';

function consentRow(over: Record<string, unknown> = {}) {
  return {
    noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    studentConsentedAt: new Date('2026-08-08T09:00:00Z'),
    withdrawnAt: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConsentFindFirst.mockResolvedValue(consentRow());
});

describe('getCandidateDiagnosticConsentState', () => {
  it('est GRANTED sur un consentement courant de l’étudiant', async () => {
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('GRANTED');
  });

  it('est MISSING quand rien n’est enregistré', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('MISSING');
  });

  it('est MISSING quand seul le parent aurait consenti', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ studentConsentedAt: null }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('MISSING');
  });

  it('est WITHDRAWN après retrait', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: new Date() }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('WITHDRAWN');
  });

  it('est OUTDATED_NOTICE sur une version périmée', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ noticeVersion: 'candidat-libre-notice.v0' }));
    await expect(getCandidateDiagnosticConsentState(STUDENT_ID)).resolves.toBe('OUTDATED_NOTICE');
  });

  /** Le rattachement du bilan gratuit ne doit jamais servir de consentement ici. */
  it('ne consulte jamais le rattachement parent-élève du bilan gratuit', async () => {
    await getCandidateDiagnosticConsentState(STUDENT_ID);
    expect(JSON.stringify(mockConsentFindFirst.mock.calls)).not.toContain('parentStudentLink');
  });
});

describe('requireVerifiedParentalConsent', () => {
  it('laisse passer un consentement courant', async () => {
    await expect(requireVerifiedParentalConsent(STUDENT_ID)).resolves.toBeNull();
  });

  it.each([
    ['MISSING', () => mockConsentFindFirst.mockResolvedValue(null)],
    ['WITHDRAWN', () => mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: new Date() }))],
    ['OUTDATED_NOTICE', () => mockConsentFindFirst.mockResolvedValue(consentRow({ noticeVersion: 'v0' }))],
  ])('bloque en 403 quand l’état est %s', async (state, arrange) => {
    arrange();
    const response = await requireVerifiedParentalConsent(STUDENT_ID);
    expect(response?.status).toBe(403);
    const body = await response?.json();
    expect(body.code).toBe(CONSENT_REQUIRED_CODE);
    expect(body.consentState).toBe(state);
    expect(body.noticeVersion).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
  });

  it('échoue fermé si la lecture échoue', async () => {
    mockConsentFindFirst.mockRejectedValue(new Error('db down'));
    expect((await requireVerifiedParentalConsent(STUDENT_ID))?.status).toBe(403);
  });
});
