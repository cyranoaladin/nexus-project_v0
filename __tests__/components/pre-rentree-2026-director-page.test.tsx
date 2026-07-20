import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

import PreRentree2026Page from '@/app/stages/pre-rentree-2026/page';
import { getPreRentreeLandingDTO } from '@/lib/campaigns/pre-rentree-2026/getters';

jest.mock('@/lib/analytics', () => ({
  toPreRentreeEntryLevel: (level: string) => level.toLowerCase(),
  track: new Proxy({}, { get: () => jest.fn() }),
}));
jest.mock('@/components/layout/CorporateNavbar', () => ({ CorporateNavbar: () => <nav>Navigation</nav> }));
jest.mock('@/components/layout/CorporateFooter', () => ({ CorporateFooter: () => <footer>Pied de page</footer> }));

describe('Pré-rentrée 2026 director landing contract', () => {
  it('presents four entry levels, both ranges, exact deposits, and gated operations', () => {
    const dto = getPreRentreeLandingDTO();
    const { container } = render(<PreRentree2026Page />);

    for (const level of dto.levels) {
      expect(screen.getAllByText(level.label).length).toBeGreaterThan(0);
    }
    expect(screen.getByRole('heading', { name: 'Nexus Fondations' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nexus Premium' })).toBeInTheDocument();
    for (const amount of [105, 120, 144, 270, 405, 540]) {
      expect(container.textContent?.replace(/[\s\u00a0]/g, '')).toContain(`${amount}TND`);
    }
    expect(screen.getAllByText(/planning de revue/i).length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/Manuel Nexus offert/i);
    expect(container.textContent).not.toMatch(/quatre documents personnalisés/i);
  });

  it('keeps the public funnel at information request until a validated proposal', () => {
    const { container } = render(<PreRentree2026Page />);
    expect(screen.getAllByText(/Demander un parcours ou un conseil/i).length).toBeGreaterThan(0);
    expect(container.querySelector('a[href*="/bilan-gratuit"]')).toBeNull();
    expect(container.textContent).toMatch(/acompte.*30\s*%/i);
    expect(container.textContent).toMatch(/réserve la place/i);
  });
});
