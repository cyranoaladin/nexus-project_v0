import { render, screen, fireEvent } from '@testing-library/react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

// Proves the flip described in lib/campaigns/pre-rentree-2026/navigation.ts:
// turning SHOW_PRE_RENTREE_IN_PERMANENT_NAV on is the entire diff needed to
// restore the navbar entry, with no other code change.
jest.mock('@/lib/campaigns/pre-rentree-2026/navigation', () => ({
  ...jest.requireActual('@/lib/campaigns/pre-rentree-2026/navigation'),
  SHOW_PRE_RENTREE_IN_PERMANENT_NAV: true,
}));

describe('CorporateNavbar with SHOW_PRE_RENTREE_IN_PERMANENT_NAV enabled', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/offres');
  });

  it('exposes the Pré-rentrée campaign as the first Programmes entry, desktop and mobile', async () => {
    render(<CorporateNavbar />);

    fireEvent.click(screen.getByRole('button', { name: 'Programmes' }));
    const desktopLink = await screen.findByTestId('pre-rentree-nav-desktop');
    expect(desktopLink).toHaveAttribute('href', '/stages/pre-rentree-2026');
    expect(desktopLink).toHaveTextContent('Pré-rentrée 2026');

    fireEvent.click(screen.getByRole('button', { name: /ouvrir le menu/i }));
    const mobileLink = await screen.findByTestId('pre-rentree-nav-mobile');
    expect(mobileLink).toHaveAttribute('href', '/stages/pre-rentree-2026');
  });
});
