jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  markQuoteConsultedIfSent: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    contactLead: { findUnique: jest.fn() },
  },
}));

import { getFamilyQuoteView, getQuoteForFamilyView } from '@/lib/quotes/public-view.server';
import { getQuoteByPublicToken, markQuoteConsultedIfSent } from '@/lib/quotes/persistence.server';
import { prisma } from '@/lib/prisma';

const mockLookup = getQuoteByPublicToken as jest.Mock;
const mockMarkConsulted = markQuoteConsultedIfSent as jest.Mock;
const mockContactLeadFindUnique = prisma.contactLead.findUnique as jest.Mock;

describe('getQuoteForFamilyView', () => {
  beforeEach(() => jest.clearAllMocks());

  test('marks a sent quote as consulted on the family HTML/API read path', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    const consultedAt = new Date('2027-01-02T03:04:05.000Z');
    mockMarkConsulted.mockResolvedValue(consultedAt);

    const result = await getQuoteForFamilyView('family-token');

    expect(result.quote).toEqual({ ...quote, status: 'DEVIS_CONSULTE', consultedAt });
    expect(mockMarkConsulted).toHaveBeenCalledWith('quote-1');
  });

  test('keeps the family read available when the best-effort transition fails', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockMarkConsulted.mockRejectedValue(new Error('transition unavailable'));

    await expect(getQuoteForFamilyView('family-token')).resolves.toEqual({ quote });
  });

  test('returns the original snapshot when a concurrent staff transition wins', async () => {
    const quote = { id: 'quote-1', status: 'DEVIS_ENVOYE', lines: [] };
    mockLookup.mockResolvedValue({ quote });
    mockMarkConsulted.mockResolvedValue(null);

    await expect(getQuoteForFamilyView('family-token')).resolves.toEqual({ quote });
  });

  test('does not transition an invalid, already consulted, or staff-follow-up quote', async () => {
    mockLookup.mockResolvedValueOnce({ quote: null, reason: 'NOT_FOUND' });
    await expect(getQuoteForFamilyView('missing')).resolves.toEqual({ quote: null, reason: 'NOT_FOUND' });

    const quote = { id: 'quote-2', status: 'DEVIS_CONSULTE', lines: [] };
    mockLookup.mockResolvedValueOnce({ quote });
    await expect(getQuoteForFamilyView('already-consulted')).resolves.toEqual({ quote });

    const followUpQuote = { id: 'quote-3', status: 'A_RAPPELER', lines: [] };
    mockLookup.mockResolvedValueOnce({ quote: followUpQuote });
    await expect(getQuoteForFamilyView('follow-up')).resolves.toEqual({ quote: followUpQuote });

    expect(mockMarkConsulted).not.toHaveBeenCalled();
  });

  test('projects a strict, humanized family allowlist without internal quote metadata', async () => {
    const quote = {
      id: 'quote-secret-id',
      contactLeadId: 'lead-secret-id',
      profilId: 'profil-1',
      studentId: 'student-1',
      status: 'DEVIS_ENVOYE',
      examSession: 2027,
      budget: 900,
      strategy: 'BEST_BALANCE',
      matchedOfferId: 'PACK_INTERNAL',
      currency: 'TND',
      monthlyTotal: 783,
      grandTotal: 10_440,
      deposit: 2_610,
      lastInstallmentAmount: 783,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      parcours: 'P1_LIBRE_2ANS_MODALITE_A',
      validUntil: new Date('2027-09-30T00:00:00.000Z'),
      diagnosticChecksum: 'diagnostic-secret',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      pricingVersion: 'v1',
      snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
      snapshotRegles: {
        costPolicy: 'BUSINESS_CONFIG', margin: { gate: 'MARGIN_OK', value: 41 },
        groupState: { state: 'NOT_APPLICABLE' }, moduleId: 'MOD_EDS1',
      },
      student: { user: { firstName: 'Inès', lastName: 'Ben Salem' } },
      profil: {
        level: 'TERMINALE',
        specialite1: 'MATHEMATIQUES',
        specialite2: 'NSI',
        specialiteAbandonnee: 'NSI',
      },
      lines: [
        {
          id: 'line-secret-id',
          subject: 'Spécialité de première non poursuivie (regroupement mono-discipline)',
          modality: 'GROUPE',
          hoursPerMonth: 4,
          unitPrice: 250,
          months: 10,
          lineTotal: 2_500,
          sortOrder: 0,
          reason:
            'MOD_SPECIALITE_ABANDONNEE · Important : cet accompagnement porte sur le programme de Première de la spécialité non poursuivie. Il ne constitue pas, dans sa formule actuelle, une préparation spécifique à l’évaluation ponctuelle correspondante du baccalauréat.',
          offerId: 'MOD_SPECIALITE_ABANDONNEE',
          priority: 'INTERNAL_PRIORITY',
        },
      ],
    };
    mockLookup.mockResolvedValue({ quote });
    mockMarkConsulted.mockResolvedValue(new Date('2027-01-02T03:04:05.000Z'));
    mockContactLeadFindUnique.mockResolvedValue({
      name: 'Mme Amel Ben Salem',
      email: 'amel@example.test',
      phone: '+216 00 000 000',
    });

    const result = await getFamilyQuoteView('raw-family-token-secret');

    expect(result.quote).toEqual(
      expect.objectContaining({
        statusLabel: 'Devis consulté',
        examSession: 2027,
        responsable: {
          name: 'Mme Amel Ben Salem',
          email: 'amel@example.test',
          phone: '+216 00 000 000',
        },
        eleve: { firstName: 'Inès', lastName: 'Ben Salem', displayName: 'Inès Ben Salem' },
        profil: {
          level: 'Terminale',
          parcours: 'Candidat individuel — parcours sur deux ans',
          specialites: ['Mathématiques', 'NSI'],
          specialiteAbandonnee: 'NSI',
        },
        totalAnnuel: 10_440,
        acompte: 2_610,
        mensualite: 783,
        nombreMensualites: 10,
        canAccept: true,
        hasPdf: true,
        echeancier: [
          { label: 'Acompte', amount: 2_610 },
          ...Array.from({ length: 9 }, (_, index) => ({ label: `Mensualité ${index + 1}/10`, amount: 783 })),
          { label: 'Mensualité 10/10', amount: 783 },
        ],
      }),
    );
    expect(result.quote?.lines).toEqual([
      {
        subject: 'NSI — spécialité de Première non poursuivie',
        format: 'Petit groupe',
        hoursPerMonth: 4,
        unitPrice: 250,
        months: 10,
        lineTotal: 2_500,
      },
    ]);

    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'quote-secret-id',
      'lead-secret-id',
      'line-secret-id',
      'raw-family-token-secret',
      'strategy',
      'matchedOfferId',
      'reason',
      'offerId',
      'priority',
      'costPolicy',
      'margin',
      'diagnostic',
      'MOD_',
      'BEST_BALANCE',
      'GROUPE',
      'TERMINALE',
      'P1_LIBRE_2ANS_MODALITE_A',
      'DEVIS_CONSULTE',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('reconstructs a legacy null-deposit schedule from persisted months and totals', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'legacy-quote',
        profilId: null,
        contactLeadId: null,
        status: 'DEVIS_CONSULTE',
        examSession: 2027,
        currency: 'TND',
        monthlyTotal: 470,
        grandTotal: 4_700,
        deposit: null,
        lastInstallmentAmount: null,
        paymentPolicy: null,
        parcours: null,
        validUntil: new Date('2027-09-30T00:00:00.000Z'),
        student: null,
        profil: null,
        lines: [{
          subject: 'Français', modality: 'GROUPE', hoursPerMonth: 8, unitPrice: 470,
          months: 10, lineTotal: 4_700, sortOrder: 0, reason: 'legacy',
        }],
      },
    });

    const result = await getFamilyQuoteView('legacy-family-link');

    expect(result.quote?.echeancier).toHaveLength(10);
    expect(result.quote?.echeancier[0]).toEqual({ label: 'Mensualité 1/10', amount: 470 });
    expect(result.quote?.echeancier[9]).toEqual({ label: 'Mensualité 10/10', amount: 470 });
    expect(result.quote?.echeancier.reduce((sum, item) => sum + item.amount, 0)).toBe(4_700);
    expect(JSON.stringify(result.quote?.echeancier)).not.toMatch(/montant unique|paiement intégral/i);
    expect(result.quote).toEqual(expect.objectContaining({ canAccept: true, hasPdf: false }));
  });

  test('humanizes parcours from the frozen exam-card snapshot when the quote column is null', async () => {
    mockLookup.mockResolvedValue({
      quote: {
        id: 'candidate-quote', profilId: 'profil-1', contactLeadId: 'lead-1', studentId: 'student-1', status: 'DEVIS_CONSULTE',
        examSession: 2027, currency: 'TND', monthlyTotal: 470, grandTotal: 4_700,
        deposit: null, lastInstallmentAmount: null, paymentPolicy: null, parcours: null,
        regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE', pricingVersion: 'v1',
        snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'NOT_APPLICABLE' } },
        snapshotCarte: {
          emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false,
          carte: { parcours: { parcoursPrincipal: 'P1_LIBRE_2ANS_MODALITE_A' } },
        },
        validUntil: new Date('2027-09-30T00:00:00.000Z'), student: null,
        profil: { level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', specialiteAbandonnee: null },
        lines: [{ subject: 'Mathématiques', modality: 'GROUPE', hoursPerMonth: 8, unitPrice: 470, months: 10, lineTotal: 4_700, sortOrder: 0, reason: 'ok' }],
      },
    });

    const result = await getFamilyQuoteView('candidate-family-link');
    expect(result.quote?.profil?.parcours).toBe('Candidat individuel — parcours sur deux ans');
    expect(JSON.stringify(result)).not.toContain('P1_LIBRE_2ANS_MODALITE_A');
  });
});
