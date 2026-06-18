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
    expect(screen.getByRole('heading', { name: /des stages utiles, structurés et pensés pour la progression réelle/i })).toBeInTheDocument();
    expect(screen.getByText(/les dates précises sont communiquées selon le niveau, l’établissement et la formule recommandée/i)).toBeInTheDocument();
    expect(screen.getByText(/prérentrée août 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/printemps 2026|20 avril|1er mai|8 juin/i)).not.toBeInTheDocument();
  });
});
