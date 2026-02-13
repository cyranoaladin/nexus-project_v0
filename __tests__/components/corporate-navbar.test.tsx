import { render, screen, fireEvent } from '@testing-library/react';
import { CorporateNavbar } from '@/components/layout/CorporateNavbar';

const usePathnameMock = jest.fn();

jest.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

describe('CorporateNavbar', () => {
  beforeEach(() => {
    usePathnameMock.mockReturnValue('/offres');
  });

  it('opens the overlay menu and shows grouped sections', () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    expect(screen.getByText('Essentiel')).toBeInTheDocument();
    expect(screen.getByText('Programmes')).toBeInTheDocument();
    expect(screen.getByText('À propos')).toBeInTheDocument();
  });

  it('renders the next-step CTA in the overlay', () => {
    render(<CorporateNavbar />);

    const openButton = screen.getByRole('button', { name: /ouvrir le menu/i });
    fireEvent.click(openButton);

    expect(screen.getByText('Prochaine étape')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /bilan gratuit/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /parler à un expert/i }).length).toBeGreaterThan(0);
  });
});
