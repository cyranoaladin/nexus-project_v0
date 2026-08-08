/**
 * Recueil du consentement candidat libre.
 *
 * La Phase 1 a posé le garde-fou qui **lit** le consentement ; sans moyen de
 * l'enregistrer, l'état restait `MISSING` en permanence. Ce service le rend
 * recueillable — et lui seul écrit dans `CandidateDiagnosticConsent`.
 *
 * Trois exigences que le stockage seul ne garantit pas : le consentement vient
 * du parent **actuellement** rattaché, il porte la **version de notice**
 * réellement présentée, et il est **retirable**.
 */

const mockStudentFindUnique = jest.fn();
const mockConsentFindFirst = jest.fn();
const mockConsentUpsert = jest.fn();
const mockConsentUpdate = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: (...a: unknown[]) => mockStudentFindUnique(...a) },
    candidateDiagnosticConsent: {
      findFirst: (...a: unknown[]) => mockConsentFindFirst(...a),
      upsert: (...a: unknown[]) => mockConsentUpsert(...a),
      update: (...a: unknown[]) => mockConsentUpdate(...a),
    },
    candidateDiagnosticAuditLog: { create: (...a: unknown[]) => mockAuditCreate(...a) },
  },
}));

import {
  ConsentRecordingError,
  grantParentalConsent,
  recordStudentAssent,
  withdrawParentalConsent,
} from '@/lib/diagnostics/candidat-libre/consent-recording.server';
import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from '@/lib/diagnostics/candidat-libre/privacy-notice';

const STUDENT_ID = 'stu_1';
const PARENT_ID = 'usr_parent_1';

beforeEach(() => {
  jest.clearAllMocks();
  mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: { userId: PARENT_ID } });
  mockConsentUpsert.mockImplementation(async ({ create }: any) => ({ id: 'c1', ...create }));
  mockConsentFindFirst.mockResolvedValue({
    id: 'c1',
    studentId: STUDENT_ID,
    parentUserId: PARENT_ID,
    noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    withdrawnAt: null,
  });
  mockConsentUpdate.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
});

describe('grantParentalConsent', () => {
  it('enregistre le consentement du parent rattaché', async () => {
    await grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });

    const { create } = mockConsentUpsert.mock.calls[0][0];
    expect(create.studentId).toBe(STUDENT_ID);
    expect(create.parentUserId).toBe(PARENT_ID);
    expect(create.noticeVersion).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
    expect(create.parentConsentedAt).toBeInstanceOf(Date);
  });

  /** Le titulaire de l'autorité parentale peut avoir changé. */
  it('refuse un parent qui n’est pas celui actuellement rattaché', async () => {
    await expect(grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: 'usr_autre_parent',
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    })).rejects.toThrow(ConsentRecordingError);
    expect(mockConsentUpsert).not.toHaveBeenCalled();
  });

  it('refuse quand l’élève n’a aucun parent rattaché', async () => {
    mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: null });
    await expect(grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    })).rejects.toThrow(/NO_PARENT/);
  });

  /**
   * Le consentement porte sur un texte précis : accepter une version que la
   * famille n'a pas vue reviendrait à enregistrer un consentement non éclairé.
   */
  it('refuse une version de notice qui n’est pas la version courante', async () => {
    await expect(grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: PARENT_ID,
      noticeVersion: 'candidat-libre-notice.v0',
    })).rejects.toThrow(/NOTICE_VERSION/);
    expect(mockConsentUpsert).not.toHaveBeenCalled();
  });

  it('journalise le recueil', async () => {
    await grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
      diagnosticId: 'diag_1',
    });
    expect(mockAuditCreate).toHaveBeenCalled();
    const { data } = mockAuditCreate.mock.calls[0][0];
    expect(data.action).toBe('PARENTAL_CONSENT_GRANTED');
  });

  it('ne journalise pas sans dossier existant', async () => {
    await grantParentalConsent({
      studentId: STUDENT_ID,
      parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });
});

describe('recordStudentAssent', () => {
  it('horodate l’assentiment de l’élève sur le consentement courant', async () => {
    await recordStudentAssent({ studentId: STUDENT_ID });
    const { data } = mockConsentUpdate.mock.calls[0][0];
    expect(data.studentAssentedAt).toBeInstanceOf(Date);
  });

  it('refuse tant que le parent n’a pas consenti', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(recordStudentAssent({ studentId: STUDENT_ID }))
      .rejects.toThrow(/PARENTAL_CONSENT_REQUIRED/);
    expect(mockConsentUpdate).not.toHaveBeenCalled();
  });

  it('refuse sur un consentement retiré', async () => {
    mockConsentFindFirst.mockResolvedValue({
      id: 'c1', studentId: STUDENT_ID, parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION, withdrawnAt: new Date(),
    });
    await expect(recordStudentAssent({ studentId: STUDENT_ID })).rejects.toThrow(/WITHDRAWN/);
  });

  it('refuse sur une notice périmée', async () => {
    mockConsentFindFirst.mockResolvedValue({
      id: 'c1', studentId: STUDENT_ID, parentUserId: PARENT_ID,
      noticeVersion: 'candidat-libre-notice.v0', withdrawnAt: null,
    });
    await expect(recordStudentAssent({ studentId: STUDENT_ID })).rejects.toThrow(/NOTICE_VERSION/);
  });
});

describe('withdrawParentalConsent', () => {
  it('horodate le retrait', async () => {
    await withdrawParentalConsent({ studentId: STUDENT_ID, parentUserId: PARENT_ID });
    const { data } = mockConsentUpdate.mock.calls[0][0];
    expect(data.withdrawnAt).toBeInstanceOf(Date);
  });

  it('conserve le motif quand il est fourni', async () => {
    await withdrawParentalConsent({
      studentId: STUDENT_ID, parentUserId: PARENT_ID, reason: 'Demande de la famille',
    });
    expect(mockConsentUpdate.mock.calls[0][0].data.withdrawnReason).toBe('Demande de la famille');
  });

  it('refuse un retrait demandé par un autre que le parent rattaché', async () => {
    await expect(withdrawParentalConsent({ studentId: STUDENT_ID, parentUserId: 'usr_autre' }))
      .rejects.toThrow(ConsentRecordingError);
    expect(mockConsentUpdate).not.toHaveBeenCalled();
  });

  it('est idempotent sur un consentement déjà retiré', async () => {
    const already = new Date('2026-08-01T10:00:00Z');
    mockConsentFindFirst.mockResolvedValue({
      id: 'c1', studentId: STUDENT_ID, parentUserId: PARENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION, withdrawnAt: already,
    });
    const result = await withdrawParentalConsent({ studentId: STUDENT_ID, parentUserId: PARENT_ID });
    expect(result.withdrawnAt).toEqual(already);
    expect(mockConsentUpdate).not.toHaveBeenCalled();
  });

  it('ne fait rien s’il n’y a aucun consentement à retirer', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(withdrawParentalConsent({ studentId: STUDENT_ID, parentUserId: PARENT_ID }))
      .rejects.toThrow(/NO_CONSENT/);
  });
});
