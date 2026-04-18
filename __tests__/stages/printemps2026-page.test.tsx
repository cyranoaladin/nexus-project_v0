import { render, screen } from '@testing-library/react';
import StagesPage from '@/app/stages/page';

jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop) => {
        return ({ children, initial, animate, exit, transition, whileHover, whileTap, variants, ...rest }: any) => (
          <div data-motion={String(prop)} {...rest}>
            {children}
          </div>
        );
      },
    }
  ),
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useAnimation: () => ({ start: jest.fn() }),
  useInView: () => [null, true],
}));

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));

jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

jest.mock('@/app/stages/_components/StageReservationModal', () => ({
  __esModule: true,
  default: () => <div data-testid="reservation-modal" />,
}));

jest.mock('@/app/stages/_components/StickyMobileCTA', () => ({
  __esModule: true,
  default: () => <div data-testid="sticky-cta" />,
}));

describe('Stages page — NexusStagesPage', () => {
  it('renders the page shell with navbar and footer', () => {
    render(<StagesPage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders key offer titles from the static catalogue', () => {
    render(<StagesPage />);

    expect(screen.getByText(/Maths Première/i)).toBeInTheDocument();
    expect(screen.getByText(/Français Première/i)).toBeInTheDocument();
  });

  it('does not use emoji glyphs as product and section icons anymore', () => {
    const { container } = render(<StagesPage />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/[🎯📖📐💻🖥🎤🌿⚡🚨✍🎓🏆⚔🎭]/u);
  });

  it('does not expose February-only copy on the active /stages page', () => {
    render(<StagesPage />);

    expect(screen.queryByText(/stage de février/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/boost décisif/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pallier 1/i)).not.toBeInTheDocument();
  });
});
