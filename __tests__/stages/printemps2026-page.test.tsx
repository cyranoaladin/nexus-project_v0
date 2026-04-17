import { render, screen } from '@testing-library/react';

import StagesPage from '@/app/stages/page';
import { listPublicStages } from '@/lib/stages/public';

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

jest.mock('@/lib/stages/public', () => ({
  listPublicStages: jest.fn(),
  formatStageDateRange: jest.fn(() => '21 – 25 avril 2026'),
  formatStagePrice: jest.fn((amount: number, currency: string) => `${amount} ${currency}`),
  getLevelLabel: jest.fn((level: string) => level),
  isOnlineLocation: jest.fn((location?: string | null) => /en ligne/i.test(location || '')),
  subjectLabels: {
    MATHEMATIQUES: 'Maths',
    NSI: 'NSI',
    FRANCAIS: 'Français',
    PHILOSOPHIE: 'Philosophie',
    HISTOIRE_GEO: 'Histoire-Géo',
    ANGLAIS: 'Anglais',
    ESPAGNOL: 'Espagnol',
    PHYSIQUE_CHIMIE: 'Physique-Chimie',
    SVT: 'SVT',
    SES: 'SES',
  },
}));

const mockListPublicStages = listPublicStages as jest.Mock;

describe('Stages catalogue page', () => {
  beforeEach(() => {
    mockListPublicStages.mockResolvedValue([
      {
        id: 'stage-1',
        slug: 'printemps-2026',
        title: 'Stage Printemps 2026',
        subtitle: 'Révisions ciblées avant les échéances de mai et juin.',
        description: 'Description complète',
        type: 'INTENSIF',
        typeLabel: 'Intensif',
        subject: ['MATHEMATIQUES', 'NSI'],
        level: ['Première', 'Terminale'],
        startDate: '2026-04-21T08:00:00.000Z',
        endDate: '2026-04-25T17:00:00.000Z',
        capacity: 12,
        priceAmount: 850,
        priceCurrency: 'TND',
        location: 'Centre Urbain Nord, Tunis',
        isVisible: true,
        isOpen: true,
        reservationCounts: { PENDING: 2, CONFIRMED: 6, WAITLISTED: 0, CANCELLED: 0, COMPLETED: 0 },
        activeReservations: 8,
        confirmedReservations: 6,
        availablePlaces: 4,
        _count: { reservations: 8 },
        sessions: [],
        coaches: [],
        bilans: [],
      },
      {
        id: 'stage-2',
        slug: 'grand-oral-juin',
        title: 'Grand Oral Juin',
        subtitle: null,
        description: null,
        type: 'GRAND_ORAL',
        typeLabel: 'Grand Oral',
        subject: ['FRANCAIS'],
        level: ['Terminale'],
        startDate: '2026-05-10T08:00:00.000Z',
        endDate: '2026-05-12T17:00:00.000Z',
        capacity: 8,
        priceAmount: 420,
        priceCurrency: 'TND',
        location: 'En ligne',
        isVisible: true,
        isOpen: false,
        reservationCounts: { PENDING: 0, CONFIRMED: 8, WAITLISTED: 2, CANCELLED: 0, COMPLETED: 0 },
        activeReservations: 8,
        confirmedReservations: 8,
        availablePlaces: 0,
        _count: { reservations: 8 },
        sessions: [],
        coaches: [],
        bilans: [],
      },
    ]);
  });

  it('renders the dynamic catalogue on /stages', async () => {
    render(await StagesPage());

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getAllByText(/catalogue stages 2026/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('heading', { level: 1, name: /les stages nexus réussite/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/stage printemps 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/grand oral juin/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /s'inscrire/i })
    ).toHaveAttribute('href', '/stages/printemps-2026/inscription');
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('shows the new catalogue cards with availability and pricing', async () => {
    render(await StagesPage());

    expect(
      screen.getByText(/4 places disponibles/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/complet — liste d'attente/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/850 TND/i)).toBeInTheDocument();
    expect(screen.getByText(/420 TND/i)).toBeInTheDocument();
    expect(screen.getByText(/stage terminé/i)).toBeInTheDocument();
  });

  it('does not use emoji glyphs as product and section icons anymore', async () => {
    const { container } = render(await StagesPage());
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/[🎯📖📐💻🖥🎤🌿⚡🚨✍🎓🏆⚔🎭]/u);
  });

  it('does not expose February-only copy on the active /stages page', async () => {
    render(await StagesPage());

    expect(screen.queryByText(/stage de février/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/boost décisif/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pallier 1/i)).not.toBeInTheDocument();
  });
});
