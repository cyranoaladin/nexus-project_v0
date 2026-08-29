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

test('family link accepts a published quote only after the commercial DEVIS_ENVOYE transition', () => {
  expect(collectFamilyLinkIssuanceBlockers(completeQuote('DEVIS_ENVOYE'))).toEqual([]);
  expect(collectFamilyLinkIssuanceBlockers(completeQuote('ESTIMATION'))).toContain('status != DEVIS_ENVOYE');
});
