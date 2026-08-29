import { toCandidatIndividuelStaffQuoteView } from '@/lib/quotes/candidat-individuel-staff-view.server';

describe('candidat individuel staff quote DTO', () => {
  test('projette uniquement les lignes persistées humanisées et les actions, sans donnée interne ni token', () => {
    const view = toCandidatIndividuelStaffQuoteView({
      id: 'quote-1',
      status: 'ESTIMATION',
      regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
      updatedAt: new Date('2026-08-29T10:00:00.000Z'),
      monthlyTotal: 720,
      grandTotal: 9600,
      deposit: 2400,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      publicTokenHash: 'hash-never-exposed',
      snapshotRegles: {
        margin: { marginPct: 35.4, gate: 'HUMAN_REVIEW_REQUIRED' },
        costPolicy: { provenance: 'BUSINESS_CONFIG' },
        internalReason: 'never expose',
      },
      lines: [
        {
          subject: 'Mathématiques',
          modality: 'INDIVIDUEL',
          hoursPerMonth: 4,
          unitPrice: 720,
          sortOrder: 0,
          reason: 'internal diagnostic',
          offerId: 'MOD_EDS1',
        },
      ],
    });

    expect(view).toEqual({
      id: 'quote-1',
      statusLabel: 'Validé pour la famille',
      updatedAt: '2026-08-29T10:00:00.000Z',
      totals: { annualTnd: 9600, depositTnd: 2400, installmentTnd: 720, installmentCount: 10 },
      lines: [{ subject: 'Mathématiques', modality: 'Individuel', hoursPerMonth: 4, monthlyAmountTnd: 720 }],
      margin: { percentage: 35.4, statusLabel: 'Validation de la marge requise' },
      actions: {
        canPublish: false,
        canIssueFamilyLink: true,
        canDownloadPdf: true,
        canCreateRevision: true,
        hasFamilyLink: true,
      },
    });
    expect(JSON.stringify(view)).not.toMatch(/hash-never|BUSINESS_CONFIG|internal diagnostic|MOD_EDS1|HUMAN_REVIEW_REQUIRED/);
  });

  test('échoue fermé sur un libellé de matière interne inconnu', () => {
    const view = toCandidatIndividuelStaffQuoteView({
      id: 'quote-2',
      status: 'ESTIMATION',
      regulatoryMaturity: 'LEGACY_ESTIMATE_UNVERIFIED',
      updatedAt: new Date('2026-08-29T10:00:00.000Z'),
      monthlyTotal: 250,
      grandTotal: 2500,
      deposit: 625,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      publicTokenHash: null,
      snapshotRegles: null,
      lines: [{ subject: 'MOD_UNKNOWN', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 250, sortOrder: 0 }],
    });

    expect(view.lines[0].subject).toBe('Matière à vérifier');
    expect(JSON.stringify(view)).not.toContain('MOD_UNKNOWN');
  });
});
