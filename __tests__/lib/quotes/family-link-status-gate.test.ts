jest.mock('server-only', () => ({}));

import type { Quote } from '@prisma/client';
import { collectFamilyLinkIssuanceBlockers } from '@/lib/quotes/emission-guard';

function completeQuote(status: Quote['status']): Quote {
  return {
    status,
    regulatoryMaturity: 'CARTE_VALIDATED_DEFINITIVE',
    profilId: 'profil-1',
    pricingVersion: 'pricing-v1',
    snapshotRegles: { margin: { gate: 'MARGIN_OK' }, groupState: { state: 'NOT_APPLICABLE' } },
    snapshotCarte: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
    grandTotal: 2500,
    monthlyTotal: 250,
    contactLeadId: 'lead-1',
    studentId: 'student-1',
  } as unknown as Quote;
}

test.each(['DEVIS_ENVOYE', 'DEVIS_CONSULTE', 'A_RAPPELER'] as const)(
  'family-link issuance or rotation remains available for %s',
  (status) => {
    expect(collectFamilyLinkIssuanceBlockers(completeQuote(status))).toEqual([]);
  },
);

test.each([
  'ESTIMATION',
  'BILAN_A_FAIRE',
  'BILAN_TERMINE',
  'ACCEPTE',
  'REFUSE',
  'INSCRIT',
  'EXPIRE',
] as const)('family-link issuance or rotation fails closed for %s', (status) => {
  expect(collectFamilyLinkIssuanceBlockers(completeQuote(status))).toContain(
    `status not family-link eligible: ${status}`,
  );
});
