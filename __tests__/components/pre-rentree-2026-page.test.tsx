import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreRentree2026Page, { generateMetadata } from '@/app/stages/pre-rentree-2026/page';
import { CampaignPageTracker } from '@/components/pre-rentree-2026/CampaignPageTracker';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';
import { track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
  track: {
    preRentreePageView: jest.fn(),
    preRentreeLevelSelected: jest.fn(),
    preRentreeTrackSelected: jest.fn(),
    preRentreeSubjectSelected: jest.fn(),
    preRentreeScheduleViewed: jest.fn(),
    preRentreeProgramViewed: jest.fn(),
    preRentreePriceSummaryViewed: jest.fn(),
    preRentreeBilanClicked: jest.fn(),
    preRentreeWhatsAppClicked: jest.fn(),
    preRentreePreregistrationStarted: jest.fn(),
  },
}));

jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav>Navigation</nav> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer>Pied de page</footer> }));

describe('Pré-rentrée 2026 page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits one page view when React replays effects in Strict Mode', () => {
    render(
      <StrictMode>
        <CampaignPageTracker />
      </StrictMode>,
    );

    expect(track.preRentreePageView).toHaveBeenCalledTimes(1);
  });

  it('renders the contract H1 without internal campaign copy or online payment', () => {
    const dto = getPreRentreeLandingDTO();
    const { container } = render(<PreRentree2026Page />);

    expect(screen.getByRole('heading', { level: 1, name: dto.content.hero.h1 })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Statut de campagne/i);
    expect(container.textContent).not.toContain('PRE_REGISTRATION_OPEN');
    expect(screen.getAllByText(/Aucun paiement en ligne n[’']est demandé/i).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/15\s*h(?:eures)?/i);
    expect(container.textContent).not.toMatch(/places? restantes?/i);
  });

  it('derives complete SEO metadata from the DTO', () => {
    const dto = getPreRentreeLandingDTO();
    const metadata = generateMetadata();

    expect(metadata.title).toBe(dto.seo.title);
    expect(metadata.description).toBe(dto.seo.description);
    expect(metadata.alternates?.canonical).toBe(dto.seo.canonical);
    expect(metadata.openGraph).toEqual(expect.objectContaining({ url: dto.seo.canonical }));
    expect(metadata.twitter).toEqual(expect.objectContaining({ title: dto.seo.title }));
  });

  it('renders FAQPage structured data without offers or availability', () => {
    const { container } = render(<PreRentree2026Page />);
    const structured = container.querySelector('script[type="application/ld+json"]');
    const json = structured?.textContent ?? '';
    expect(json).toContain('FAQPage');
    expect(json).not.toMatch(/availability|AggregateOffer|rating/i);
  });

  it('synchronizes configured entry class with planning and programs without mutating the form from tabs', async () => {
    const user = userEvent.setup();
    render(<PreRentree2026Page />);

    const planning = screen.getByRole('heading', { name: 'Planning et emplois du temps' }).closest('section');
    const programs = screen.getByRole('heading', { name: 'Programmes détaillés' }).closest('section');
    if (!planning || !programs) throw new Error('Campaign sections missing');

    expect(screen.getByRole('radio', { name: 'Entrée en Seconde' })).not.toBeChecked();
    expect(within(planning).getByRole('tab', { name: 'Entrée en Seconde' })).toHaveAttribute('aria-selected', 'true');
    expect(within(programs).getByRole('tab', { name: 'Entrée en Seconde' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('radio', { name: 'Entrée en Première' }));
    expect(within(planning).getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');
    expect(within(programs).getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(planning).getByRole('tab', { name: 'Entrée en Terminale' }));
    expect(screen.getByRole('radio', { name: 'Entrée en Première' })).toBeChecked();
    expect(within(programs).getByRole('tab', { name: 'Entrée en Première' })).toHaveAttribute('aria-selected', 'true');

    await user.click(within(programs).getByRole('tab', { name: 'Entrée en Terminale' }));
    expect(screen.getByRole('radio', { name: 'Entrée en Première' })).toBeChecked();
  });
});
