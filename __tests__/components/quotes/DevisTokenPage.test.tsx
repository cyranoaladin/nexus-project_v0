import { render, screen } from '@testing-library/react';
import DevisTokenPage from '@/app/devis/[token]/page';
import { getFamilyQuoteView } from '@/lib/quotes/public-view.server';

jest.mock('@/lib/quotes/public-view.server', () => ({
  getQuoteForFamilyView: jest.fn(),
  getFamilyQuoteView: jest.fn(),
}));
jest.mock('next/navigation', () => ({ notFound: jest.fn() }));
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav /> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer /> }));
jest.mock('@/components/premium/format', () => ({ fmtTND: (value: number) => `${value} TND` }));
jest.mock('@/components/quotes/AcceptQuoteButton', () => ({
  AcceptQuoteButton: ({ quoteId, token }: { quoteId: string; token: string }) => (
    <div>{`accept:${quoteId}:${token}`}</div>
  ),
}));

const mockFamilyView = getFamilyQuoteView as jest.Mock;

describe('DevisTokenPage family-safe rendering', () => {
  test('renders identities, humanized profile, pricing, warnings and PDF without raw internals', async () => {
    mockFamilyView.mockResolvedValue({
      quote: {
        statusLabel: 'Devis consulté',
        examSession: 2027,
        validUntil: '2027-09-30T00:00:00.000Z',
        currency: 'TND',
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
        mensualite: 783,
        totalAnnuel: 10_440,
        acompte: 2_610,
        nombreMensualites: 10,
        echeancier: [
          { label: 'Acompte', amount: 2_610 },
          { label: 'Mensualité 1/10', amount: 783 },
          { label: 'Mensualité 10/10', amount: 783 },
        ],
        lines: [
          {
            subject: 'NSI — spécialité de Première non poursuivie',
            format: 'Petit groupe',
            hoursPerMonth: 4,
            unitPrice: 250,
            months: 10,
            lineTotal: 2_500,
          },
        ],
        warnings: [
          'Important : cet accompagnement porte sur le programme de Première de la spécialité non poursuivie.',
        ],
      },
    });

    const token = ['family-link', 'render-sentinel'].join('-');
    const view = render(await DevisTokenPage({ params: Promise.resolve({ token }) }));

    expect(screen.getByText('Mme Amel Ben Salem')).toBeInTheDocument();
    expect(screen.getByText('Inès Ben Salem')).toBeInTheDocument();
    expect(screen.getByText(/Terminale/)).toBeInTheDocument();
    expect(screen.getByText(/Candidat individuel — parcours sur deux ans/)).toBeInTheDocument();
    expect(screen.getByText(/Mathématiques.*NSI/)).toBeInTheDocument();
    expect(screen.getByText('NSI — spécialité de Première non poursuivie')).toBeInTheDocument();
    expect(screen.getByText(/Petit groupe · 4 h \/ mois/)).toBeInTheDocument();
    expect(screen.getByText('10440 TND')).toBeInTheDocument();
    expect(screen.getAllByText('2610 TND')).toHaveLength(2);
    expect(screen.getByText(/10 mensualités/)).toBeInTheDocument();
    expect(screen.getByText('Mensualité 1/10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Télécharger le PDF/i })).toHaveAttribute(
      'href',
      `/api/quotes/public/${token}/pdf`,
    );

    const rendered = view.container.textContent ?? '';
    expect(rendered).not.toContain(token);
    expect(rendered).not.toMatch(
      /MOD_|P1_LIBRE_2ANS_MODALITE_A|BEST_BALANCE|GROUPE|DEVIS_CONSULTE|costPolicy|margin|diagnostic|reason|matchedOfferId/,
    );
  });
});
