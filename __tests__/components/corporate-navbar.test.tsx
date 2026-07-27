import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('CorporateNavbar', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/offres');
  });

  it('opens the mobile overlay menu and shows the public navigation groups', async () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getAllByText('Offres & tarifs').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Programmes').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Contact').length).toBeGreaterThan(0);
    });
  });

  it('renders the next-step CTA in the overlay', async () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText('Prochaine étape')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /se connecter/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /demander un bilan/i }).length).toBeGreaterThan(0);
    });
  });

  it('does not expose the gated Pré-rentrée campaign from permanent navigation', () => {
    render(<CorporateNavbar />);

    expect(screen.queryByTestId('pre-rentree-nav-desktop')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pre-rentree-nav-mobile')).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/stages/pre-rentree-2026"]')).toBeNull();
  });

  it('keeps Connexion available inside the mobile menu', async () => {
    render(<CorporateNavbar />);
    fireEvent.click(screen.getByRole('button', { name: /ouvrir le menu/i }));

    const menu = await screen.findByRole('dialog', { name: 'Menu principal' });
    expect(within(menu).getByRole('link', { name: /se connecter/i })).toHaveAttribute('href', '/auth/signin');
  });
});
