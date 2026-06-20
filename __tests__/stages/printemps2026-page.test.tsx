import { render, screen } from '@testing-library/react';
import StagesPage from '@/app/stages/page';

jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, ...rest }: any) => (
          <div data-motion={String(prop)} {...rest}>
            {children}
          </div>
        );
      },
    },
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useAnimation: () => ({ start: jest.fn() }),
  useInView: () => [null, true],
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children }: any) => <>{children}</>,
}));

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
    expect(screen.getByText(/Pré-Rentrée/)).toBeInTheDocument();
    expect(screen.getByText(/Toussaint/)).toBeInTheDocument();
    expect(screen.getByText(/Noël/)).toBeInTheDocument();
    expect(screen.getByText(/Février/)).toBeInTheDocument();
    expect(screen.getByText(/Printemps \/ Prépa-Bac/)).toBeInTheDocument();
    // Verify exact dates are displayed
    expect(screen.getByText(/24.*août 2026/)).toBeInTheDocument();
    expect(screen.getByText(/26.*avr.*7 mai 2027/)).toBeInTheDocument();
  });
});
