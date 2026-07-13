import { render, screen } from '@testing-library/react';
import StagesPage from '@/app/stages/page';

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

describe('Stages page — 2026/2027', () => {
  it('renders the page shell with the active stages copy', () => {
    render(<StagesPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Viser.*Atteindre.*passer/i);
    expect(screen.getByRole('heading', { name: /Pré-rentrée 2026 en première position/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Découvrir la Pré-rentrée 2026/i })).toHaveAttribute('href', '/stages/pre-rentree-2026');
    expect(screen.getByText(/Toussaint/)).toBeInTheDocument();
    expect(screen.getByText(/Noël/)).toBeInTheDocument();
    expect(screen.getByText(/Février/)).toBeInTheDocument();
    expect(screen.getByText(/Printemps \/ Prépa-Bac/)).toBeInTheDocument();
    expect(screen.getByText(/Du 17 au 28 août 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Pré-Rentrée du 24 au 28 août/i)).not.toBeInTheDocument();
    expect(screen.getByText(/26.*avr.*7 mai 2027/)).toBeInTheDocument();
  });
});
