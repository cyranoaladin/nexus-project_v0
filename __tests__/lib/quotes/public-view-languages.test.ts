import { prisma } from '@/lib/prisma';
import { getFamilyQuoteView } from '@/lib/quotes/public-view.server';
import { getQuoteByPublicToken } from '@/lib/quotes/persistence.server';

jest.mock('@/lib/quotes/persistence.server', () => ({
  getQuoteByPublicToken: jest.fn(),
  markQuoteConsultedIfSent: jest.fn(),
}));

jest.mock('@/lib/quotes/emission-guard', () => ({
  collectQuoteEmissionBlockers: jest.fn(() => []),
}));

const mockLookup = getQuoteByPublicToken as jest.Mock;

test('la vue publique transporte les langues humanisées sans enum interne', async () => {
  mockLookup.mockResolvedValue({
    quote: {
      id: 'quote-language', status: 'DEVIS_CONSULTE', profilId: 'profil-1', contactLeadId: 'lead-1',
      examSession: 2027, validUntil: new Date('2027-09-30T00:00:00.000Z'), monthlyTotal: 470,
      grandTotal: 4_700, deposit: null, paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      profil: {
        level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
        specialiteAbandonnee: null, langueA: 'ARABE', langueB: 'RUSSE',
      },
      student: { user: { firstName: 'Inès', lastName: 'Ben Salem' } },
      lines: [{
        subject: 'Mathématiques', reason: '', modality: 'GROUPE', hoursPerMonth: 4,
        unitPrice: 470, months: 10, lineTotal: 4_700, sortOrder: 0,
      }],
    },
  });
  (prisma.contactLead.findUnique as jest.Mock).mockResolvedValue({
    name: 'Mme Ben Salem', email: 'parent@example.test', phone: null,
  });

  const result = await getFamilyQuoteView('opaque-language-token');

  expect(result.quote?.profil?.langues).toEqual(['LVA : Arabe', 'LVB : Russe']);
  expect(JSON.stringify(result.quote?.profil)).not.toMatch(/ARABE|RUSSE/);
});

test('la vue publique omet des Subjects corrompus au lieu de les afficher comme langues', async () => {
  mockLookup.mockResolvedValue({
    quote: {
      id: 'quote-corrupt-language', status: 'DEVIS_CONSULTE', profilId: 'profil-2', contactLeadId: null,
      examSession: 2027, validUntil: new Date('2027-09-30T00:00:00.000Z'), monthlyTotal: 470,
      grandTotal: 4_700, deposit: null, paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      profil: {
        level: 'TERMINALE', specialite1: 'MATHEMATIQUES', specialite2: 'NSI', specialiteAbandonnee: null,
        langueA: 'MATHEMATIQUES', langueB: 'NSI',
      },
      student: null,
      lines: [{ subject: 'Mathématiques', reason: '', modality: 'GROUPE', hoursPerMonth: 4, unitPrice: 470, months: 10, lineTotal: 4_700, sortOrder: 0 }],
    },
  });

  const result = await getFamilyQuoteView('opaque-corrupt-token');

  expect(result.quote?.profil?.langues).toEqual([]);
});
