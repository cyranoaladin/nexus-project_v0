/**
 * Recueil du consentement candidat libre — étudiant majeur.
 *
 * L'étudiant est adulte : **son** consentement autorise le traitement de ses
 * données. Le lien parental subsiste pour la structure du dossier, mais
 * n'autorise plus rien.
 *
 * La propriété que ces tests protègent avant tout : le parent **ne voit rien
 * par défaut**. Ses documents d'identité, son enregistrement audio et le
 * jugement de faisabilité qui le concerne ne regardent que lui, tant qu'il n'a
 * pas explicitement ouvert l'accès — et il peut le refermer.
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
  grantStudentConsent,
  isParentAccessAuthorized,
  setParentAccessAuthorization,
  withdrawStudentConsent,
} from '@/lib/diagnostics/candidat-libre/consent-recording.server';
import { CANDIDATE_DIAGNOSTIC_NOTICE_VERSION } from '@/lib/diagnostics/candidat-libre/privacy-notice';

const STUDENT_ID = 'stu_1';
const PARENT_ID = 'usr_parent_1';

function consentRow(over: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    studentId: STUDENT_ID,
    parentUserId: PARENT_ID,
    noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    studentConsentedAt: new Date('2026-08-08T09:00:00Z'),
    parentAccessAuthorizedAt: null,
    withdrawnAt: null,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockStudentFindUnique.mockResolvedValue({ id: STUDENT_ID, parent: { userId: PARENT_ID } });
  mockConsentUpsert.mockImplementation(async ({ create }: any) => ({ id: 'c1', ...create }));
  mockConsentUpdate.mockImplementation(async ({ data }: any) => ({ id: 'c1', ...data }));
  mockConsentFindFirst.mockResolvedValue(consentRow());
});

describe('grantStudentConsent', () => {
  it('enregistre le consentement de l’étudiant lui-même', async () => {
    await grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });
    const { create } = mockConsentUpsert.mock.calls[0][0];
    expect(create.studentConsentedAt).toBeInstanceOf(Date);
    expect(create.noticeVersion).toBe(CANDIDATE_DIAGNOSTIC_NOTICE_VERSION);
  });

  /** Le parent est enregistré pour la structure, pas comme autorité consentante. */
  it('n’enregistre aucun consentement parental', async () => {
    await grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });
    const { create } = mockConsentUpsert.mock.calls[0][0];
    expect(create.parentConsentedAt).toBeUndefined();
    expect(create.parentUserId).toBe(PARENT_ID);
  });

  it('n’ouvre aucun accès au parent à la création', async () => {
    await grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });
    const { create } = mockConsentUpsert.mock.calls[0][0];
    expect(create.parentAccessAuthorizedAt ?? null).toBeNull();
  });

  it('refuse une version de notice qui n’est pas la version courante', async () => {
    await expect(grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: 'candidat-libre-notice.v0',
    })).rejects.toThrow(/NOTICE_VERSION/);
    expect(mockConsentUpsert).not.toHaveBeenCalled();
  });

  it('relève un retrait antérieur sans effacer la trace', async () => {
    await grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
    });
    const { update } = mockConsentUpsert.mock.calls[0][0];
    expect(update.withdrawnAt).toBeNull();
    expect(update.studentConsentedAt).toBeInstanceOf(Date);
  });

  it('journalise le consentement comme acte de l’étudiant', async () => {
    await grantStudentConsent({
      studentId: STUDENT_ID,
      noticeVersion: CANDIDATE_DIAGNOSTIC_NOTICE_VERSION,
      diagnosticId: 'diag_1',
    });
    const { data } = mockAuditCreate.mock.calls[0][0];
    expect(data.action).toBe('STUDENT_CONSENT_GRANTED');
    expect(data.actorRole).toBe('ELEVE');
  });
});

describe('accès du parent — fermé par défaut', () => {
  it('est refusé tant que l’étudiant n’a rien autorisé', async () => {
    await expect(isParentAccessAuthorized(STUDENT_ID)).resolves.toBe(false);
  });

  it('s’ouvre sur autorisation explicite de l’étudiant', async () => {
    await setParentAccessAuthorization({ studentId: STUDENT_ID, authorized: true });
    expect(mockConsentUpdate.mock.calls[0][0].data.parentAccessAuthorizedAt).toBeInstanceOf(Date);
  });

  it('se referme sur révocation', async () => {
    await setParentAccessAuthorization({ studentId: STUDENT_ID, authorized: false });
    expect(mockConsentUpdate.mock.calls[0][0].data.parentAccessAuthorizedAt).toBeNull();
  });

  it('est autorisé quand l’étudiant l’a ouvert', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ parentAccessAuthorizedAt: new Date() }));
    await expect(isParentAccessAuthorized(STUDENT_ID)).resolves.toBe(true);
  });

  /** Un retrait de consentement referme tout, y compris un accès déjà ouvert. */
  it('retombe à refusé si le consentement est retiré', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({
      parentAccessAuthorizedAt: new Date(),
      withdrawnAt: new Date(),
    }));
    await expect(isParentAccessAuthorized(STUDENT_ID)).resolves.toBe(false);
  });

  it('refuse d’ouvrir un accès sur un consentement retiré', async () => {
    mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: new Date() }));
    await expect(setParentAccessAuthorization({ studentId: STUDENT_ID, authorized: true }))
      .rejects.toThrow(/WITHDRAWN/);
    expect(mockConsentUpdate).not.toHaveBeenCalled();
  });

  it('refuse d’ouvrir un accès sans consentement', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(setParentAccessAuthorization({ studentId: STUDENT_ID, authorized: true }))
      .rejects.toThrow(ConsentRecordingError);
  });
});

describe('withdrawStudentConsent', () => {
  it('horodate le retrait', async () => {
    await withdrawStudentConsent({ studentId: STUDENT_ID });
    expect(mockConsentUpdate.mock.calls[0][0].data.withdrawnAt).toBeInstanceOf(Date);
  });

  it('conserve le motif quand il est fourni', async () => {
    await withdrawStudentConsent({ studentId: STUDENT_ID, reason: 'Je préfère arrêter' });
    expect(mockConsentUpdate.mock.calls[0][0].data.withdrawnReason).toBe('Je préfère arrêter');
  });

  it('est idempotent sur un consentement déjà retiré', async () => {
    const already = new Date('2026-08-01T10:00:00Z');
    mockConsentFindFirst.mockResolvedValue(consentRow({ withdrawnAt: already }));
    const result = await withdrawStudentConsent({ studentId: STUDENT_ID });
    expect(result.withdrawnAt).toEqual(already);
    expect(mockConsentUpdate).not.toHaveBeenCalled();
  });

  it('refuse quand il n’y a rien à retirer', async () => {
    mockConsentFindFirst.mockResolvedValue(null);
    await expect(withdrawStudentConsent({ studentId: STUDENT_ID }))
      .rejects.toThrow(/NO_CONSENT/);
  });
});
