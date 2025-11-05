import { PillarsSection } from '@/components/sections/pillars-section';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock de next/image
jest.mock('next/image', () => {
  return function MockedImage({ src, alt, ...props }: any) {
    return <img src={src} alt={alt} {...props} />;
  };
});

// Mock de framer-motion
jest.mock('framer-motion', () => {
  const filterMotionProps = ({
    initial,
    animate,
    transition,
    whileInView,
    whileHover,
    viewport,
    exit,
    layout,
    variants,
    ...rest
  }: Record<string, unknown>) => rest;

  return {
    motion: {
      div: ({ children, ...props }: any) => <div {...filterMotionProps(props)}>{children}</div>,
    },
  };
});

describe('PillarsSection', () => {
  it('renders the section title correctly', () => {
    render(<PillarsSection />);

    expect(screen.getByRole('heading', { level: 2, name: /Excellence Augmentée/i })).toBeInTheDocument();
    expect(screen.getByText(/Notre Promesse/i)).toBeInTheDocument();
  });

  it('renders the section description', () => {
    render(<PillarsSection />);

    expect(screen.getByText(/Nous avons construit un écosystème unique/i)).toBeInTheDocument();
  });

  it('renders all four pillars', () => {
    render(<PillarsSection />);

    expect(screen.getByText(/Des Coachs d'Exception/i)).toBeInTheDocument();
    expect(screen.getByText(/Une Technologie Qui Fait la Différence/i)).toBeInTheDocument();
    expect(screen.getByText(/Votre Parcours, Votre Stratégie/i)).toBeInTheDocument();
    expect(screen.getByText(/Des Résultats Concrets/i)).toBeInTheDocument();
  });

  it('renders pillar descriptions', () => {
    render(<PillarsSection />);

    expect(screen.getByText(/Nous ne recrutons que l'élite/i)).toBeInTheDocument();
    expect(screen.getByText(/Nous avons développé des outils propriétaires/i)).toBeInTheDocument();
    expect(screen.getByText(/Il n'y a pas de solution unique/i)).toBeInTheDocument();
    expect(screen.getByText(/Notre accompagnement ne s'arrête pas aux bonnes notes/i)).toBeInTheDocument();
  });

  it('renders all pillar images', () => {
    render(<PillarsSection />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(4);

    expect(screen.getByAltText(/Accompagnement bienveillant par nos experts/i)).toBeInTheDocument();
    expect(screen.getByAltText(/ARIA - Notre Intelligence Artificielle/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Accompagnement personnalisé des familles/i)).toBeInTheDocument();
    expect(screen.getByAltText(/Coaching Parcoursup et orientation/i)).toBeInTheDocument();
  });

  it('renders feature lists with checkmarks', () => {
    render(<PillarsSection />);

    // Vérifier quelques features importantes
    expect(screen.queryAllByText(/Professeurs/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Agrégés & Certifiés/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/IA ARIA/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Bilan Stratégique/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Parcoursup/i).length).toBeGreaterThan(0);
  });

  it('renders DIU NSI tooltip functionality', () => {
    render(<PillarsSection />);

    // Vérifier la présence du texte DIU NSI
    expect(screen.getByText(/DIU NSI/)).toBeInTheDocument();
  });

  it('handles DIU tooltip interactions', () => {
    render(<PillarsSection />);

    // Trouver le bouton de tooltip DIU NSI
    const tooltipButton = screen.getAllByRole('button')[0];

    // Cliquer sur le tooltip
    fireEvent.click(tooltipButton);

    // Vérifier que le contenu du tooltip est affiché
    expect(screen.getByText(/Qu'est-ce que le DIU NSI/i)).toBeInTheDocument();
  });

  it('renders proper semantic structure', () => {
    render(<PillarsSection />);

    const section = document.querySelector('section');
    expect(section).not.toBeNull();

    const headings = screen.getAllByRole('heading');
    expect(headings.length).toBeGreaterThan(0);
  });

  it('renders without crashing', () => {
    expect(() => render(<PillarsSection />)).not.toThrow();
  });

  it('has proper accessibility attributes for images', () => {
    render(<PillarsSection />);

    const images = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
      expect(img.getAttribute('alt')).not.toBe('');
    });
  });
});
