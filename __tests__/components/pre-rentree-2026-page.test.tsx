import '@testing-library/jest-dom';
import { StrictMode } from 'react';
import { render, screen, within } from '@testing-library/react';
import PreRentree2026Page, { generateMetadata } from '@/app/stages/pre-rentree-2026/page';
import { CampaignPageTracker } from '@/components/pre-rentree-2026/CampaignPageTracker';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';
import { track } from '@/lib/analytics';

jest.mock('@/lib/analytics', () => ({
  track: { preRentreePageView: jest.fn() },
}));

jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav>Navigation</nav> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer>Pied de page</footer> }));
jest.mock('@/lib/campaigns/pre-rentree-2026/release-gate', () => ({
  getPreRentreeReleaseGate: () => ({ releaseStatus: 'PUBLIC_READY', isPublicReady: true }),
}));

describe('Pré-rentrée 2026 canonical public page', () => {
  beforeEach(() => jest.clearAllMocks());

  it('emits one page view when React replays effects in Strict Mode', () => {
    render(<StrictMode><CampaignPageTracker /></StrictMode>);
    expect(track.preRentreePageView).toHaveBeenCalledTimes(1);
  });

  it('renders only approved commercial content and the canonical WhatsApp CTA', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    const { container } = render(<PreRentree2026Page />);

    expect(screen.getByRole('heading', { level: 1, name: dto.title })).toBeInTheDocument();
    expect(screen.getByText(dto.promise)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: `WhatsApp ${dto.contact.whatsappDisplay}` })).toHaveAttribute(
      'href',
      expect.stringContaining('wa.me/21699192829'),
    );
    expect(container.textContent).not.toMatch(/Gate|REVIEW|blocked|owner|placeholder|SNT/i);
    expect(container.textContent).not.toMatch(/ARIA|Cyclades|manuel offert|remise annuelle|enseignant qualifié|bilan parent/i);
    expect(screen.queryByRole('heading', { name: /planning|emplois du temps|programmes détaillés/i })).not.toBeInTheDocument();
  });

  it('renders all thirteen canonical offers with price, deposit, inclusions and exclusions', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    render(<PreRentree2026Page />);
    const catalogue = document.querySelector<HTMLElement>('#offres-pre-rentree');
    if (!catalogue) throw new Error('Canonical offer catalogue missing');

    expect(within(catalogue).getAllByRole('article')).toHaveLength(dto.offers.length);
    expect(within(catalogue).getAllByRole('heading', { name: 'Inclus' })).toHaveLength(dto.offers.length);
    expect(within(catalogue).getAllByRole('heading', { name: 'Non inclus' })).toHaveLength(dto.offers.length);
    for (const offer of dto.offers) {
      expect(catalogue.textContent?.replace(/\s/g, '')).toContain(`${offer.price}TND`);
      expect(catalogue.textContent?.replace(/\s/g, '')).toContain(`${offer.deposit}TND`);
    }
  });

  it('derives SEO metadata and fail-closed robots from the public adapter', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    const metadata = generateMetadata();

    expect(metadata.title).toBe(dto.seo.title);
    expect(metadata.description).toBe(dto.seo.description);
    expect(metadata.alternates?.canonical).toBe(dto.seo.canonical);
    expect(metadata.openGraph).toEqual(expect.objectContaining({ url: dto.seo.canonical }));
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true });
  });

  it('renders aligned FAQ and offer structured data without availability claims', () => {
    const { container } = render(<PreRentree2026Page />);
    const structured = container.querySelector('script[type="application/ld+json"]');
    const json = structured?.textContent ?? '';
    expect(json).toContain('FAQPage');
    expect(json).toContain('ItemList');
    expect(json).toContain('Course');
    expect(json).not.toMatch(/availability|AggregateOffer|rating/i);
  });
});
