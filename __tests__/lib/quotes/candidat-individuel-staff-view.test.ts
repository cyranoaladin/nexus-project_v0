import { prisma } from '@/lib/prisma';
import {
  getCandidatIndividuelStaffProfileView,
  toCandidatIndividuelStaffQuoteView,
} from '@/lib/quotes/candidat-individuel-staff-view.server';

function quoteSource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote-1',
    status: 'ESTIMATION',
    regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
    profilId: 'profil-1',
    contactLeadId: 'lead-1',
    studentId: 'student-1',
    pricingVersion: '2026.1',
    updatedAt: new Date('2026-08-29T10:00:00.000Z'),
    monthlyTotal: 720,
    grandTotal: 9600,
    deposit: 2400,
    paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    snapshotRegles: {
      margin: { marginPct: 45, gate: 'MARGIN_OK' },
      groupState: { state: 'NOT_APPLICABLE' },
    },
    lines: [
      { subject: 'Mathématiques', modality: 'INDIVIDUEL', hoursPerMonth: 4, unitPrice: 720, months: 10, sortOrder: 0 },
    ],
    auditLogs: [],
    ...overrides,
  } as unknown as Parameters<typeof toCandidatIndividuelStaffQuoteView>[0];
}

describe('candidat individuel staff quote DTO', () => {
  test('humanise chaque statut réel sans le déduire de la maturité', () => {
    const expected = {
      ESTIMATION: 'Estimation provisoire',
      BILAN_A_FAIRE: 'En attente de votre bilan',
      BILAN_TERMINE: 'Bilan terminé',
      DEVIS_ENVOYE: 'Devis envoyé',
      DEVIS_CONSULTE: 'Devis consulté',
      A_RAPPELER: 'Notre équipe vous recontacte',
      ACCEPTE: 'Devis accepté',
      REFUSE: 'Devis refusé',
      INSCRIT: 'Inscription confirmée',
      EXPIRE: 'Devis expiré',
    } as const;

    for (const [status, statusLabel] of Object.entries(expected)) {
      expect(toCandidatIndividuelStaffQuoteView(quoteSource({ status, regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' })).statusLabel).toBe(statusLabel);
    }
  });

  test('aligne publication, premier lien et rotation sur les guards serveur et sur les seuls audits de lien', () => {
    const publishable = toCandidatIndividuelStaffQuoteView(quoteSource());
    expect(publishable.actions).toMatchObject({
      canPublish: true,
      canIssueFamilyLink: false,
      canRotateFamilyLink: false,
      hasFamilyLink: false,
    });

    const familyReady = quoteSource({ status: 'DEVIS_ENVOYE', regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' });
    expect(toCandidatIndividuelStaffQuoteView(familyReady).actions).toMatchObject({
      canPublish: false,
      canIssueFamilyLink: true,
      canRotateFamilyLink: false,
      hasFamilyLink: false,
    });

    const rotated = toCandidatIndividuelStaffQuoteView(quoteSource({
      status: 'DEVIS_CONSULTE',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      publicTokenHash: 'initial-or-rotated-hash-must-not-decide',
      auditLogs: [{ action: 'CREATED' }, { action: 'LINK_ISSUED' }],
    }));
    expect(rotated.actions).toMatchObject({ canIssueFamilyLink: true, canRotateFamilyLink: true, hasFamilyLink: true });

    for (const status of ['ACCEPTE', 'REFUSE', 'INSCRIT', 'EXPIRE']) {
      const terminal = toCandidatIndividuelStaffQuoteView(quoteSource({ status, regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE' }));
      expect(terminal.actions.canPublish).toBe(false);
      expect(terminal.actions.canIssueFamilyLink).toBe(false);
      expect(terminal.actions.canRotateFamilyLink).toBe(false);
    }
    expect(JSON.stringify(rotated)).not.toMatch(/publicTokenHash|initial-or-rotated|CREATED|LINK_ISSUED/);
  });

  test('dérive le nombre de mensualités des lignes persistées pour une entrée en cours d’année', () => {
    const view = toCandidatIndividuelStaffQuoteView(quoteSource({
      lines: [{ subject: 'Mathématiques', modality: 'DUO', hoursPerMonth: 4, unitPrice: 360, months: 6, sortOrder: 0 }],
    }));
    expect(view.totals.installmentCount).toBe(6);
  });

  test('humanise une revue de marge valide sans exposer le motif ni l’auteur', () => {
    const view = toCandidatIndividuelStaffQuoteView(quoteSource({
      snapshotRegles: {
        margin: { marginPct: 35.4, gate: 'HUMAN_REVIEW_REQUIRED' },
        marginOverride: { reason: 'secret commercial', byUserId: 'staff-secret', at: '2026-08-29T09:00:00.000Z' },
        groupState: { state: 'NOT_APPLICABLE' },
      },
    }));
    expect(view.margin).toEqual({ percentage: 35.4, statusLabel: 'Marge validée par le staff' });
    expect(JSON.stringify(view)).not.toMatch(/secret commercial|staff-secret|reason|byUserId/);
  });

  test('échoue fermé sur un libellé de matière interne inconnu', () => {
    const view = toCandidatIndividuelStaffQuoteView(quoteSource({
      lines: [{ subject: 'MOD_UNKNOWN', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 250, months: 10, sortOrder: 0 }],
    }));
    expect(view.lines[0].subject).toBe('Matière à vérifier');
    expect(JSON.stringify(view)).not.toContain('MOD_UNKNOWN');
  });
});

test('profile resume exposes the same explicit Student.id/User.id/parent contract as search', async () => {
  (prisma.profilCandidat.findUnique as jest.Mock).mockResolvedValue({
    id: 'profil-1',
    contactLead: { id: 'lead-1', name: 'Sonia', email: 'parent@example.test', phone: null, status: 'NEW' },
    student: {
      id: 'student-profile-1',
      user: { id: 'student-user-1', firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test', mergedIntoUserId: null },
      parent: { id: 'parent-profile-1', user: { id: 'parent-user-1', firstName: 'Sonia', lastName: 'Ben Salah', email: 'parent@example.test', mergedIntoUserId: null } },
    },
    langueA: 'ARABE',
    langueB: 'RUSSE',
    quotes: [],
  });

  await expect(getCandidatIndividuelStaffProfileView('profil-1')).resolves.toMatchObject({
    student: {
      studentId: 'student-profile-1', userId: 'student-user-1',
      responsible: { parentProfileId: 'parent-profile-1', userId: 'parent-user-1' },
    },
    langues: ['LVA : Arabe', 'LVB : Russe'],
  });
});

test('profile resume omits corrupted non-language Subjects from its human summary', async () => {
  (prisma.profilCandidat.findUnique as jest.Mock).mockResolvedValue({
    id: 'profil-corrupt', langueA: 'MATHEMATIQUES', langueB: 'NSI', student: null, quotes: [],
  });

  await expect(getCandidatIndividuelStaffProfileView('profil-corrupt')).resolves.toMatchObject({ langues: [] });
});
