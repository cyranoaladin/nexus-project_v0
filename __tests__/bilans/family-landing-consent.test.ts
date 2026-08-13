import { createHash } from 'node:crypto';

import {
  resolveShareLinkContext,
  verifyAndConsumeShareTokenPdf,
} from '@/lib/bilans/staff/share-link-service';
import { audienceArtifactChecksum } from '@/lib/bilans/core/report-artifact-integrity';

jest.mock('@/lib/bilans/parent-student-consent', () => ({
  withParentStudentConsentTransaction: jest.fn(),
}));

import { withParentStudentConsentTransaction } from '@/lib/bilans/parent-student-consent';
import {
  FamilyConsentError,
  readConsentStateFromShareToken,
  recordConsentFromShareToken,
} from '@/lib/bilans/family-landing/consent';

/**
 * Page d'arrivée famille : le lien signé est la preuve d'identité.
 *
 * Preuves exigées ici :
 * — le contexte (parent, élève) se dérive du jeton sans servir le document
 *   ni journaliser une consultation ;
 * — tout jeton défaillant échoue uniformément, et le consentement n'est
 *   alors JAMAIS touché (la porte RGPD ne s'ouvre pas sur un lien invalide) ;
 * — la transition de consentement est celle du dashboard (verify), avec
 *   l'identité du lien — même traçabilité ;
 * — le PDF n'est servi qu'intègre (somme de contrôle) et jamais pour Nexus.
 */

const NOW = new Date('2026-08-13T10:00:00Z');
const mockedConsentTransaction = withParentStudentConsentTransaction as jest.Mock;

function contextHarness(linkOverrides: Record<string, unknown> = {}) {
  const secret = 'a'.repeat(43);
  const accesses: unknown[] = [];
  const link = {
    id: 'link-1',
    audience: 'PARENTS',
    tokenHash: createHash('sha256').update(secret, 'utf8').digest('hex'),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    recipientUserId: 'parent-user-1',
    reportArtifact: {
      id: 'artifact-1',
      status: 'PUBLISHED',
      currentPublishedRevisionId: 'revision-1',
      studentId: 'student-1',
      student: { user: { firstName: 'Kamel' } },
    },
    ...linkOverrides,
  };
  const database = {
    reportShareLink: { findUnique: jest.fn(async () => link) },
    shareLinkAccess: { create: jest.fn(async (args: unknown) => { accesses.push(args); return { id: 'a-1' }; }) },
  };
  return { database, accesses, token: `link-1.${secret}`, secret };
}

describe('resolveShareLinkContext', () => {
  it('dérive parent et élève du jeton, sans journaliser de consultation', async () => {
    const { database, accesses, token } = contextHarness();
    const context = await resolveShareLinkContext(token, { prisma: database as never, now: () => NOW });
    expect(context).toMatchObject({
      linkId: 'link-1',
      audience: 'PARENTS',
      reportArtifactId: 'artifact-1',
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      studentFirstName: 'Kamel',
    });
    expect(accesses).toHaveLength(0);
  });

  it.each([
    ['secret altéré', {}, 'link-1.' + 'b'.repeat(43)],
    ['jeton malformé', {}, 'sans-point'],
    ['jeton vide après le point', {}, 'link-1.'],
  ])('refuse un jeton défaillant : %s', async (_label, overrides, badToken) => {
    const { database } = contextHarness(overrides);
    expect(await resolveShareLinkContext(badToken, { prisma: database as never, now: () => NOW })).toBeNull();
  });

  it.each([
    ['révoqué', { revokedAt: NOW }],
    ['expiré', { expiresAt: new Date(NOW.getTime() - 1) }],
    ['bilan non diffusé', { reportArtifact: { id: 'artifact-1', status: 'PENDING_REVIEW', currentPublishedRevisionId: 'revision-1', studentId: 'student-1', student: { user: { firstName: 'K' } } } }],
    ['révision publiée absente', { reportArtifact: { id: 'artifact-1', status: 'PUBLISHED', currentPublishedRevisionId: null, studentId: 'student-1', student: { user: { firstName: 'K' } } } }],
    ['audience Nexus', { audience: 'NEXUS' }],
  ])('refuse un lien invalide : %s', async (_label, overrides) => {
    const { database, token } = contextHarness(overrides);
    expect(await resolveShareLinkContext(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });
});

function pdfHarness(overrides: Record<string, unknown> = {}) {
  const secret = 'a'.repeat(43);
  const pdf = Buffer.from('%PDF-1.4 contenu');
  const html = '<html>parents</html>';
  const checksum = audienceArtifactChecksum({ audience: 'PARENTS', html, pdfStatus: 'READY', pdf });
  const accesses: unknown[] = [];
  const link = {
    id: 'link-1',
    audience: 'PARENTS',
    tokenHash: createHash('sha256').update(secret, 'utf8').digest('hex'),
    expiresAt: new Date(NOW.getTime() + 86_400_000),
    revokedAt: null,
    reportArtifact: {
      status: 'PUBLISHED',
      student: { user: { firstName: 'Kamel' } },
      currentPublishedRevision: {
        materialization: {
          audienceArtifacts: [
            { audience: 'PARENTS', html, pdf, pdfStatus: 'READY', checksum },
          ],
        },
      },
    },
    ...overrides,
  };
  const database = {
    reportShareLink: { findUnique: jest.fn(async () => link) },
    shareLinkAccess: { create: jest.fn(async (args: unknown) => { accesses.push(args); return { id: 'a-1' }; }) },
  };
  return { database, accesses, token: `link-1.${secret}`, pdf, html };
}

describe('verifyAndConsumeShareTokenPdf', () => {
  it('sert le PDF intègre et journalise la consultation', async () => {
    const { database, accesses, token, pdf } = pdfHarness();
    const served = await verifyAndConsumeShareTokenPdf(token, { prisma: database as never, now: () => NOW });
    expect(served?.audience).toBe('PARENTS');
    expect(served?.pdf.equals(pdf)).toBe(true);
    expect(accesses).toHaveLength(1);
  });

  it('refuse un PDF dont la somme de contrôle ne correspond plus', async () => {
    const { database, token, accesses } = pdfHarness();
    const link = await database.reportShareLink.findUnique();
    link.reportArtifact.currentPublishedRevision.materialization.audienceArtifacts[0].checksum = 'f'.repeat(64);
    expect(await verifyAndConsumeShareTokenPdf(token, { prisma: database as never, now: () => NOW })).toBeNull();
    expect(accesses).toHaveLength(0);
  });

  it('refuse quand le PDF est indisponible', async () => {
    const { database, token, accesses } = pdfHarness();
    const link = await database.reportShareLink.findUnique();
    link.reportArtifact.currentPublishedRevision.materialization.audienceArtifacts[0].pdfStatus = 'UNAVAILABLE';
    expect(await verifyAndConsumeShareTokenPdf(token, { prisma: database as never, now: () => NOW })).toBeNull();
    expect(accesses).toHaveLength(0);
  });

  it('ne sert jamais le document Nexus', async () => {
    const { database, token } = pdfHarness({ audience: 'NEXUS' });
    expect(await verifyAndConsumeShareTokenPdf(token, { prisma: database as never, now: () => NOW })).toBeNull();
  });
});

describe('recordConsentFromShareToken', () => {
  beforeEach(() => {
    mockedConsentTransaction.mockReset();
  });

  it('valide le lien parent-élève avec l’identité portée par le jeton', async () => {
    const { database, token } = contextHarness();
    const verify = jest.fn(async () => ({ id: 'l', state: 'VERIFIED', consentedAt: NOW, verifiedAt: NOW }));
    mockedConsentTransaction.mockImplementation(async (_db, action) =>
      action({ verify, getStatus: jest.fn(), preparePending: jest.fn(), transaction: {} }));

    const result = await recordConsentFromShareToken(token, { prisma: database as never, now: () => NOW });

    expect(result).toEqual({ state: 'VERIFIED', studentId: 'student-1' });
    expect(verify).toHaveBeenCalledWith({
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now: NOW,
    });
  });

  it('GARDE : un jeton invalide ne touche JAMAIS le consentement', async () => {
    const { database } = contextHarness();
    await expect(recordConsentFromShareToken('link-1.' + 'b'.repeat(43), { prisma: database as never, now: () => NOW }))
      .rejects.toMatchObject({ code: 'INVALID_LINK' });
    await expect(recordConsentFromShareToken('malformé', { prisma: database as never, now: () => NOW }))
      .rejects.toBeInstanceOf(FamilyConsentError);
    expect(mockedConsentTransaction).not.toHaveBeenCalled();
  });

  it('un lien révoqué ou expiré ne permet pas de consentir', async () => {
    for (const overrides of [{ revokedAt: NOW }, { expiresAt: new Date(NOW.getTime() - 1) }]) {
      const { database, token } = contextHarness(overrides);
      await expect(recordConsentFromShareToken(token, { prisma: database as never, now: () => NOW }))
        .rejects.toMatchObject({ code: 'INVALID_LINK' });
    }
    expect(mockedConsentTransaction).not.toHaveBeenCalled();
  });
});

describe('readConsentStateFromShareToken', () => {
  beforeEach(() => {
    mockedConsentTransaction.mockReset();
  });

  it('retourne l’état du lien parent-élève sans transition', async () => {
    const { database, token } = contextHarness();
    const getStatus = jest.fn(async () => ({ state: 'PENDING_PARENT_CONSENT' }));
    mockedConsentTransaction.mockImplementation(async (_db, action) =>
      action({ verify: jest.fn(), getStatus, preparePending: jest.fn(), transaction: {} }));

    const result = await readConsentStateFromShareToken(token, { prisma: database as never, now: () => NOW });
    expect(result).toEqual({ state: 'PENDING_PARENT_CONSENT', studentId: 'student-1' });
    expect(getStatus).toHaveBeenCalledWith({
      parentUserId: 'parent-user-1',
      studentId: 'student-1',
      now: NOW,
    });
  });

  it('échoue uniformément sur jeton invalide', async () => {
    const { database } = contextHarness();
    await expect(readConsentStateFromShareToken('x.y', { prisma: database as never, now: () => NOW }))
      .rejects.toMatchObject({ code: 'INVALID_LINK' });
  });
});
