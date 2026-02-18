import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('CorporateNavbar', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/offres');
  });

  it('opens the overlay menu and shows grouped sections', async () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getAllByText('Essentiel').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Programmes').length).toBeGreaterThan(0);
      expect(screen.getAllByText('À propos').length).toBeGreaterThan(0);
    });
  });

  it('renders the next-step CTA in the overlay', async () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(screen.getByText('Prochaine étape')).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /se connecter/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: /s'inscrire/i }).length).toBeGreaterThan(0);
    });
  });
});
