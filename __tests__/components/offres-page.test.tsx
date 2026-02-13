import OffresPage from '@/app/offres/page';
import { render, screen } from '@testing-library/react';

// Mock environment variables before any imports
process.env.NEXT_PUBLIC_BASE_URL = 'http://localhost:3000';
process.env.NEXTAUTH_URL = 'http://localhost:3000';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Mock framer-motion — filter motion-specific props to avoid React DOM warnings
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'dragElastic', 'dragMomentum',
    'layout', 'layoutId', 'onAnimationStart', 'onAnimationComplete',
    'custom', 'inherit',
  ]);
  const filterProps = (props: any) => {
    const filtered: any = {};
    Object.keys(props).forEach((k) => { if (!motionProps.has(k)) filtered[k] = props[k]; });
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

jest.mock('@/components/ui/floating-nav', () => ({
  FloatingNav: () => <div data-testid="floating-nav">FloatingNav</div>,
}));

jest.mock('@/components/ui/offers-comparison', () => ({
  OffersComparison: () => <div data-testid="offers-comparison">OffersComparison</div>,
}));

jest.mock('@/components/ui/testimonials-section', () => ({
  TestimonialsSection: () => <div data-testid="testimonials-section">TestimonialsSection</div>,
}));

jest.mock('@/components/ui/guarantee-section', () => ({
  GuaranteeSection: () => <div data-testid="guarantee-section">GuaranteeSection</div>,
}));

jest.mock('@/components/ui/faq-section', () => ({
  FAQSection: () => <div data-testid="faq-section">FAQSection</div>,
}));

jest.mock('@/components/ui/diagnostic-form', () => ({
  DiagnosticForm: () => <div data-testid="diagnostic-form">DiagnosticForm</div>,
}));

describe('OffresPage', () => {
  beforeAll(() => {
    // Mock window.location to prevent "Invalid base URL" errors
    if (!Object.getOwnPropertyDescriptor(window, 'location')) {
      Object.defineProperty(window, 'location', {
        value: {
          href: 'http://localhost:3000',
          origin: 'http://localhost:3000',
          protocol: 'http:',
          host: 'localhost:3000',
          hostname: 'localhost',
          port: '3000',
          pathname: '/offres',
          search: '',
          hash: '',
        },
        writable: true,
        configurable: true,
      });
    }
  });

  beforeEach(() => {
    render(<OffresPage />);
  });

  describe('Rendu initial', () => {
    it('affiche la navigation et le footer', () => {
      // Check for the actual rendered navbar (CorporateNavbar)
      const navElement = document.querySelector('nav');
      expect(navElement).toBeInTheDocument();
      // Check for footer element
      const footerElement = document.querySelector('footer');
      expect(footerElement).toBeInTheDocument();
    });

    it('affiche le titre principal', () => {
      expect(screen.getByText('Investissez dans la seule garantie de réussite au Bac.')).toBeInTheDocument();
    });

    it('affiche le sous-titre', () => {
      expect(screen.getByText('Un prix unique, tout inclus. Expertise humaine + IA 24/7 + Garantie Mention.')).toBeInTheDocument();
    });

    it('affiche les boutons de navigation rapide', () => {
      const eleveSco = screen.getAllByText('Lycée français');
      const candidatLibre = screen.getAllByText('Candidat libre');
      const parentIndecis = screen.getAllByText('Parent indécis');

      expect(eleveSco.length).toBeGreaterThan(0);
      expect(candidatLibre.length).toBeGreaterThan(0);
      expect(parentIndecis.length).toBeGreaterThan(0);
    });
  });

  describe('Sections principales', () => {
    it('affiche la section offres principales', () => {
      expect(screen.getByText('3 formules, un seul objectif : la réussite')).toBeInTheDocument();
    });

    it('affiche les 3 formules réelles', () => {
      expect(screen.getByText('Accès Plateforme')).toBeInTheDocument();
      expect(screen.getByText('Hybride')).toBeInTheDocument();
      expect(screen.getByText('Immersion')).toBeInTheDocument();
    });

    it('affiche la section packs spécialisés', () => {
      const packsSection = document.querySelector('#packs-specialises');
      expect(packsSection).toBeInTheDocument();
    });

    it('affiche la section comparaison', () => {
      const comparisonSection = document.querySelector('#comparaison');
      expect(comparisonSection).toBeInTheDocument();
    });
  });

  describe('Composants intégrés', () => {
    it('affiche la section des offres principales', () => {
      const offresSection = document.querySelector('#offres-principales');
      expect(offresSection).toBeInTheDocument();
    });

    it('affiche la section des packs', () => {
      const packsSection = document.querySelector('#packs-specialises');
      expect(packsSection).toBeInTheDocument();
    });

    it('affiche la section comparaison', () => {
      const comparisonSection = document.querySelector('#comparaison');
      expect(comparisonSection).toBeInTheDocument();
    });

    it('affiche la section garanties', () => {
      const garantiesSection = document.querySelector('#garanties');
      expect(garantiesSection).toBeInTheDocument();
    });

    it('affiche le BackToTop', () => {
      expect(screen.getByTestId('back-to-top')).toBeInTheDocument();
    });

    it('a des sections avec navigation', () => {
      expect(screen.getAllByText(/Offres principales/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Packs à la carte/i).length).toBeGreaterThan(0);
    });
  });

  describe('Navigation et liens', () => {
    it('a des liens vers les sections avec des ancres', () => {
      const offresLinks = screen.getAllByText(/Offres principales/i);
      const packsLinks = screen.getAllByText(/Packs à la carte/i);

      const offresLink = offresLinks.find(el => el.closest('a'))?.closest('a');
      const packsLink = packsLinks.find(el => el.closest('a'))?.closest('a');

      expect(offresLink).toHaveAttribute('href', '#offres-principales');
      expect(packsLink).toHaveAttribute('href', '#packs-specialises');
    });

    it('a des sections avec les bonnes IDs', () => {
      const offresSection = document.querySelector('#offres-principales');
      const packsSection = document.querySelector('#packs-specialises');
      const comparisonSection = document.querySelector('#comparaison');

      expect(offresSection).toBeInTheDocument();
      expect(packsSection).toBeInTheDocument();
      expect(comparisonSection).toBeInTheDocument();
    });
  });

  describe('Boutons et CTAs', () => {
    it('a des boutons dans la page', () => {
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('a des boutons avec les bonnes classes CSS', () => {
      const buttons = screen.getAllByRole('button');
      const buttonWithClasses = buttons.find(button =>
        button.className.includes('rounded')
      );
      expect(buttonWithClasses).toBeTruthy();
    });
  });

  describe('Prix et offres', () => {
    it('affiche des prix', () => {
      const priceElements = document.querySelectorAll('[class*="font-bold"]');
      expect(priceElements.length).toBeGreaterThan(0);
    });

    it('affiche le badge "Recommandée"', () => {
      expect(screen.getByText(/RECOMMANDÉE/i)).toBeInTheDocument();
    });
  });

  describe('Responsive et accessibilité', () => {
    it('a des éléments avec des classes responsive', () => {
      const containers = document.querySelectorAll('.container');
      expect(containers.length).toBeGreaterThan(0);

      const grids = document.querySelectorAll('.grid');
      expect(grids.length).toBeGreaterThan(0);
    });

    it('a des images avec des attributs alt', () => {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        expect(img).toHaveAttribute('alt');
      });
    });
  });
});
