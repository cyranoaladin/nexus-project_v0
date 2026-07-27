import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import PreRentree2026Page from '@/app/stages/pre-rentree-2026/page';
import { compilePreRentreeReviewSurfaceDTO } from '@/lib/campaigns/pre-rentree-2026/public-surface';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
  track: new Proxy({}, { get: () => jest.fn() }),
}));
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav>Navigation</nav> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer>Pied de page</footer> }));
jest.mock('@/lib/campaigns/pre-rentree-2026/release-gate', () => ({
  getPreRentreeReleaseGate: () => ({ releaseStatus: 'PUBLIC_READY', isPublicReady: true }),
}));

describe('Pré-rentrée 2026 director landing contract', () => {
  it('presents four entry levels, canonical offers and exact deposits without internal operations', () => {
    const dto = compilePreRentreeReviewSurfaceDTO();
    const { container } = render(<PreRentree2026Page />);

    for (const level of dto.levels) {
      expect(screen.getAllByText(level.label).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('Fondations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Premium').length).toBeGreaterThan(0);
    for (const amount of [...new Set(dto.offers.map((offer) => offer.deposit))]) {
      expect(container.textContent?.replace(/[\s\u00a0]/g, '')).toContain(`${amount}TND`);
    }
    expect(container.textContent).not.toMatch(/planning de revue|REVIEW|Gate|blocked|owner/i);
    expect(container.textContent).not.toMatch(/Manuel Nexus offert/i);
    expect(container.textContent).not.toMatch(/quatre documents personnalisés/i);
  });

  it('keeps the public funnel at information request until a validated proposal', () => {
    const { container } = render(<PreRentree2026Page />);
    expect(screen.getAllByText(/WhatsApp|Écrire sur WhatsApp/i).length).toBeGreaterThan(0);
    expect(container.querySelector('a[href*="/bilan-gratuit"]')).toBeNull();
    expect(container.textContent).toMatch(/demande d'information/i);
    expect(container.textContent).toMatch(/sans paiement|aucun paiement/i);
  });
});
