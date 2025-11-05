import { HeroSection } from '@/components/sections/hero-section';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

// Mock du module next/link
jest.mock('next/link', () => {
  return function MockedLink({ children, href }: { children: React.ReactNode; href: string; }) {
    return <a href={href}>{children}</a>;
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
      h1: ({ children, ...props }: any) => <h1 {...filterMotionProps(props)}>{children}</h1>,
      p: ({ children, ...props }: any) => <p {...filterMotionProps(props)}>{children}</p>,
    },
  };
});

// Mock de next/image pour éviter les erreurs de base URL
jest.mock('next/image', () => {
  return function MockedImage({ src, alt, priority: _priority, ...props }: any) {
    return <img src={typeof src === 'string' ? src : ''} alt={alt} {...props} />;
  };
});

// Mock de window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('HeroSection', () => {
  beforeEach(() => {
    mockLocation.href = '';
  });

  it('renders the main headline correctly', () => {
    render(<HeroSection />);

    expect(screen.getByRole('heading', { level: 1, name: /Pédagogie Augmentée/i })).toBeInTheDocument();
    expect(screen.getByText(/pour Réussir son Bac/i)).toBeInTheDocument();
    expect(screen.getByText(/Sans Stress/i)).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<HeroSection />);

    expect(screen.getByText(/Nous fusionnons l'expertise/i)).toBeInTheDocument();
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

    expect(mockLocation.href).toBe('/bilan-gratuit');
  });

  it('secondary CTA button links to offers page', () => {
    render(<HeroSection />);

    const secondaryButton = screen.getByText(/Découvrir nos Offres/i).closest('a');
    expect(secondaryButton).toHaveAttribute('href', '/offres');
  });

  it('renders the pillars preview section', () => {
    render(<HeroSection />);

    // Vérifier la présence des piliers principaux
    expect(screen.getAllByText(/Coachs/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/IA ARIA/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Enseignement Français/i)[0]).toBeInTheDocument();
    expect(screen.getByText(/DIU NSI/i)).toBeInTheDocument();
  });

  it('displays trust indicators', () => {
    render(<HeroSection />);

    expect(screen.getByText(/Années d'Expérience Cumulée/i)).toBeInTheDocument();
    expect(screen.getByText(/d'Élèves Accompagnés/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<HeroSection />);

    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders without crashing', () => {
    expect(() => render(<HeroSection />)).not.toThrow();
  });
});
