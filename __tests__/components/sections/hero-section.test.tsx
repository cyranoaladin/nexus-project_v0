import { HeroSection } from '@/components/sections/hero-section';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock du module next/link
jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string; }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock next/image
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, priority, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock de framer-motion — filter motion-specific props
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'layout', 'layoutId',
    'onAnimationStart', 'onAnimationComplete', 'custom', 'inherit',
  ]);
  const filterProps = (props: any) => {
    const filtered: any = {};
    Object.keys(props).forEach((k) => { if (!motionProps.has(k)) filtered[k] = props[k]; });
    return filtered;
  };
  return {
    motion: {
      div: React.forwardRef(({ children, ...props }: any, ref: any) => <div {...filterProps(props)} ref={ref}>{children}</div>),
      h1: React.forwardRef(({ children, ...props }: any, ref: any) => <h1 {...filterProps(props)} ref={ref}>{children}</h1>),
      p: React.forwardRef(({ children, ...props }: any, ref: any) => <p {...filterProps(props)} ref={ref}>{children}</p>),
      button: React.forwardRef(({ children, ...props }: any, ref: any) => <button {...filterProps(props)} ref={ref}>{children}</button>),
    },
    useReducedMotion: () => false,
    AnimatePresence: ({ children }: any) => children,
  };
});

describe('HeroSection', () => {
  beforeEach(() => {
    window.location.href = '';
  });

  it('renders the main headline correctly', () => {
    render(<HeroSection />);

    // "Pédagogie Augmentée" appears in both badge and headline
    const pedagogieElements = screen.getAllByText(/Pédagogie Augmentée/i);
    expect(pedagogieElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/pour Réussir son Bac/i)).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<HeroSection />);

    expect(screen.getByText(/professeurs d'élite de l'enseignement français/i)).toBeInTheDocument();
    expect(screen.getByText(/plateforme intelligente ARIA/i)).toBeInTheDocument();
  });

  it('renders both CTA buttons', () => {
    render(<HeroSection />);

    expect(screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i)).toBeInTheDocument();
    expect(screen.getByText(/Découvrir nos Offres/i)).toBeInTheDocument();
  });

  it('primary CTA button navigates to bilan-gratuit', () => {
    render(<HeroSection />);

    const primaryButton = screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i);
    fireEvent.click(primaryButton);

    expect(window.location.href).toBe('/bilan-gratuit');
  });

  it('secondary CTA button links to offers page', () => {
    render(<HeroSection />);

    const secondaryButton = screen.getByText(/Découvrir nos Offres/i).closest('a');
    expect(secondaryButton).toHaveAttribute('href', '/offres');
  });

  it('renders the pillars preview section', () => {
    render(<HeroSection />);

    // Vérifier la présence des piliers principaux
    expect(screen.getByText(/Agrégés & Certifiés/i)).toBeInTheDocument();
    expect(screen.getByText(/IA ARIA/i)).toBeInTheDocument();
    expect(screen.getByText(/24\/7/i)).toBeInTheDocument();
    
    // Use getAllByText for items that might be found in multiple nested elements
    const enseignementElements = screen.getAllByText(/Enseignement Français/i);
    expect(enseignementElements.length).toBeGreaterThanOrEqual(1);
    
    expect(screen.getByText(/DIU NSI/i)).toBeInTheDocument();
  });

  it('displays trust indicators', () => {
    render(<HeroSection />);

    expect(screen.getByText(/Notre Force : L'Excellence de nos Experts/i)).toBeInTheDocument();
    expect(screen.getByText(/\+150/i)).toBeInTheDocument();
    expect(screen.getByText(/Années d'Expérience Cumulée/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<HeroSection />);

    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3); // Tooltip button + primary CTA + secondary button

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1); // Le lien vers les offres
  });

  it('renders without crashing', () => {
    expect(() => render(<HeroSection />)).not.toThrow();
  });
});
