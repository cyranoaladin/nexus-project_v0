import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OffresPage from '@/app/offres/page';
import { getRules } from '@/lib/pricing';
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
    const groupMax = getRules().group_max;

    const { container } = render(<OffresPage />);

    expect(screen.getByRole('heading', { name: /offres & tarifs/i })).toBeInTheDocument();
    expect(screen.getByText(/catalogue 2026\/2027/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`groupes de ${groupMax} maximum`, 'i'))).toBeInTheDocument();
    expect(screen.getByText(/accompagnement annuel — scolarisés/i)).toBeInTheDocument();
    expect(screen.getByText(/parcours candidats libres/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trois paliers numériques/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /stages intensifs — toutes les vacances/i })).toBeInTheDocument();
    expect(screen.queryByText(/garantie réussite|mention garantie|100 % réussite|100 % bac|bac garanti/i)).not.toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|NaN/);
  });

  it('exposes actionable CTAs to the conversion funnel', () => {
    render(<OffresPage />);

    expect(screen.getAllByRole('link', { name: /réserver ma place/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /poser une question/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /demander un bilan/i }).length).toBeGreaterThan(0);
  });

  it('keeps card payment provider hidden until public activation is explicitly enabled', () => {
    const { container } = render(<OffresPage />);

    expect(screen.getByText(/paiement confirmé après validation pédagogique/i)).toBeInTheDocument();
    expect(container.textContent).not.toContain(CGV_POLICY.payment.provider);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.bank);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.acceptedCards);
    expect(container.textContent).not.toContain(CGV_POLICY.payment.cardFee);
    expect(container.textContent).not.toContain(LEGAL.billing.rib);
    expect(container.textContent).not.toContain(LEGAL.billing.iban);
  });
});
