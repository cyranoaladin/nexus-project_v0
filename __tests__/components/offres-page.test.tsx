import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import OffresPage from '@/app/offres/page';
import { CGV_POLICY } from '@/lib/cgv-policy';
import { LEGAL } from '@/lib/legal';

jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set(['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap', 'whileInView', 'viewport']);
  const filterProps = (props: any) => {
    const filtered: any = {};
    Object.keys(props).forEach((key) => {
      if (!motionProps.has(key)) filtered[key] = props[key];
    });
    return filtered;
  };
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => <div {...filterProps(props)} ref={ref}>{children}</div>),
      section: React.forwardRef(({ children, ...props }: any, ref: any) => <section {...filterProps(props)} ref={ref}>{children}</section>),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => <button {...filterProps(props)} ref={ref}>{children}</button>),
    },
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => ({ get: () => 1 }),
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => children,
  };
});

describe('OffresPage', () => {
  it('renders the active catalogue without legacy campaign copy', () => {
    const { container } = render(<OffresPage />);

    expect(screen.getByRole('heading', { name: /offres & tarifs/i })).toBeInTheDocument();
    expect(screen.getByText(/catalogue 2026\/2027/i)).toBeInTheDocument();
    expect(screen.getByText(/capacité précisée par offre/i)).toBeInTheDocument();
    expect(screen.getByText(/accompagnement annuel — scolarisés/i)).toBeInTheDocument();
    expect(screen.getByText(/parcours candidats libres/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trois paliers numériques/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stages intensifs — toutes les vacances/i })).toBeInTheDocument();
    expect(screen.queryByText(/garantie réussite|mention garantie|100 % réussite|100 % bac|bac garanti/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });

  it('exposes actionable CTAs to the conversion funnel', () => {
    render(<OffresPage />);

    expect(screen.getAllByRole('link', { name: /demander cette offre/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /poser une question/i }).length).toBeGreaterThan(0);
  });

  it('renders candidat individuel qualifiers and Grand Oral ceilings from the canonical catalogue', () => {
    render(<OffresPage />);

    const surMesure = screen.getByRole('heading', { name: 'Nexus Libre — Sur mesure' }).closest('div.relative.flex');
    expect(surMesure).not.toBeNull();
    // Sans acompte, 10 mensualités identiques (commercial decision
    // 2026-09-02, URGENT FAIR HOTFIX, supersedes D4) — the displayed
    // monthly price is exactly price_annual/10 (620), not a post-acompte
    // installment.
    expect(within(surMesure as HTMLElement).getByTestId('price-primary')).toHaveTextContent(/à partir de\s*620/i);
    expect(within(surMesure as HTMLElement).getByTestId('price-secondary')).toHaveTextContent(/total à partir de\s*6[\s\u00a0]*200/i);

    const focus = screen.getByRole('heading', { name: 'Terminale Libre — Focus Bac' }).closest('div.relative.flex');
    expect(focus).not.toBeNull();
    expect(within(focus as HTMLElement).getByText(/200 h régulières/i)).toBeInTheDocument();
    expect(within(focus as HTMLElement).getByText(/grand oral.*8 h maximum/i)).toBeInTheDocument();

    const integrale = screen.getByRole('heading', { name: 'Terminale Libre — Intégrale' }).closest('div.relative.flex');
    expect(integrale).not.toBeNull();
    expect(within(integrale as HTMLElement).getByTestId('metric-total-value')).toHaveTextContent(/jusqu’à\s*300\s*h/i);
    expect(within(integrale as HTMLElement).getByText(/grand oral.*comprises? dans le plafond/i)).toBeInTheDocument();
  });

  it('surfaces fail-closed payment guidance without exposing ClicToPay or bank identifiers publicly', () => {
    const { container } = render(<OffresPage />);

    expect(screen.getByText(/paiement confirmé après validation pédagogique/i)).toBeInTheDocument();
    expect(screen.queryByText(new RegExp(CGV_POLICY.payment.provider, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(CGV_POLICY.payment.bank, 'i'))).not.toBeInTheDocument();
    expect(screen.queryByText(CGV_POLICY.payment.acceptedCards)).not.toBeInTheDocument();
    expect(screen.queryByText(CGV_POLICY.payment.cardFee)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(LEGAL.billing.rib);
    expect(container.textContent).not.toContain(LEGAL.billing.iban);
  });
});
