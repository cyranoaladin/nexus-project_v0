import { OffersPreviewSection } from '@/components/sections/offers-preview-section';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Mock de next/link
jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string; }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock de next/image
jest.mock('next/image', () => {
  return function MockedImage({ src, alt, priority, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

// Mock de framer-motion — filter all motion-specific props
jest.mock('framer-motion', () => {
  const React = require('react');
  const motionProps = new Set([
    'initial', 'animate', 'exit', 'transition', 'variants',
    'whileHover', 'whileTap', 'whileInView', 'whileFocus', 'whileDrag',
    'viewport', 'onViewportEnter', 'onViewportLeave',
    'drag', 'dragConstraints', 'layout', 'layoutId',
    'onAnimationStart', 'onAnimationComplete', 'custom', 'inherit',
  ]);
  return {
    motion: new Proxy({}, {
      get: (target, prop) => {
        return React.forwardRef((props: any, ref: any) => {
          const { children, ...rest } = props;
          const filtered: any = {};
          Object.keys(rest).forEach((k) => { if (!motionProps.has(k)) filtered[k] = rest[k]; });
          return React.createElement(prop, { ...filtered, ref }, children);
        });
      }
    }),
    AnimatePresence: ({ children }: any) => children,
    useReducedMotion: jest.fn(() => false),
    useAnimation: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      set: jest.fn(),
    })),
    useInView: jest.fn(() => true),
  };
});

describe('OffersPreviewSection', () => {
  it('renders the section title correctly', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Des Parcours Adaptés à Chaque Ambition/i)).toBeInTheDocument();
    expect(screen.getByText(/Nos Solutions/i)).toBeInTheDocument();
  });

  it('renders the section description', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Découvrez nos quatre univers de solutions/i)).toBeInTheDocument();
  });

  it('renders all four offer cards', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Nexus Cortex/i)).toBeInTheDocument();
    expect(screen.getByText(/Le Studio Flex/i)).toBeInTheDocument();
    expect(screen.getByText(/Les Académies Nexus/i)).toBeInTheDocument();
    expect(screen.getByText(/Le Programme Odyssée/i)).toBeInTheDocument();
  });

  it('renders offer subtitles', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/L'Intelligence Artificielle au service de votre réussite/i)).toBeInTheDocument();
    expect(screen.getByText(/La flexibilité absolue pour un accompagnement sur-mesure/i)).toBeInTheDocument();
    expect(screen.getByText(/Des stages intensifs pour une progression accélérée/i)).toBeInTheDocument();
    expect(screen.getByText(/L'accompagnement annuel intégral vers l'excellence/i)).toBeInTheDocument();
  });

  it('renders offer descriptions', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Votre tuteur personnel IA, disponible 24\/7/i)).toBeInTheDocument();
    expect(screen.getByText(/Accédez à la demande à nos experts/i)).toBeInTheDocument();
    expect(screen.getByText(/Des stages intensifs pendant chaque vacance scolaire/i)).toBeInTheDocument();
    expect(screen.getByText(/L'accompagnement annuel intégral qui structure/i)).toBeInTheDocument();
  });

  it('renders "Le plus populaire" badge for Studio Flex', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Le plus populaire/i)).toBeInTheDocument();
  });

  it('renders all offer icons', () => {
    render(<OffersPreviewSection />);

    const icons = screen.getAllByRole('img');
    expect(icons).toHaveLength(4);

    expect(screen.getByAltText(/Nexus Cortex/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Le Studio Flex/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Les Académies Nexus/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Le Programme Odyssée/i)).toBeInTheDocument();
  });

  it('renders "Pourquoi choisir cette solution ?" sections', () => {
    render(<OffersPreviewSection />);

    const whyTexts = screen.getAllByText(/Pourquoi choisir cette solution/i);
    expect(whyTexts).toHaveLength(4);
  });

  it('renders feature lists with check icons', () => {
    render(<OffersPreviewSection />);

    // Vérifier quelques points clés
    expect(screen.getByText(/Disponibilité 24\/7 sans interruption/i)).toBeInTheDocument();
    expect(screen.getByText(/Réservation à la demande selon vos besoins/i)).toBeInTheDocument();
    expect(screen.getByText(/Stages pendant chaque période de vacances/i)).toBeInTheDocument();
    expect(screen.getByText(/Structuration complète de votre année scolaire/i)).toBeInTheDocument();
  });

  it('renders all CTA buttons', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Découvrir notre IA/i)).toBeInTheDocument();
    expect(screen.getByText(/Explorer les prestations à la carte/i)).toBeInTheDocument();
    expect(screen.getByText(/Voir tous nos stages/i)).toBeInTheDocument();
    expect(screen.getByText(/Découvrir les parcours annuels/i)).toBeInTheDocument();
  });

  it('renders global CTA button', () => {
    render(<OffersPreviewSection />);

    expect(screen.getByText(/Voir Toutes Nos Offres/i)).toBeInTheDocument();
  });

  it('has correct links for each offer', () => {
    render(<OffersPreviewSection />);

    const links = screen.getAllByRole('link');

    // Vérifier les liens spécifiques
    const flexLink = links.find(link => link.getAttribute('href') === '/offres');
    expect(flexLink).toBeInTheDocument();

    const cortexLink = links.find(link => link.getAttribute('href') === '/offres#cortex');
    expect(cortexLink).toBeInTheDocument();

    const academiesLink = links.find(link => link.getAttribute('href') === '/offres#academies');
    expect(academiesLink).toBeInTheDocument();

    const odysseeLink = links.find(link => link.getAttribute('href') === '/offres#odyssee');
    expect(odysseeLink).toBeInTheDocument();
  });

  it('renders proper semantic structure', () => {
    render(<OffersPreviewSection />);

    // Section element should exist
    const section = document.querySelector('section');
    expect(section).toBeInTheDocument();

    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('has proper accessibility attributes for images', () => {
    render(<OffersPreviewSection />);

    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });

  it('renders without crashing', () => {
    expect(() => render(<OffersPreviewSection />)).not.toThrow();
  });
});
