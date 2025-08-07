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
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
}));

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

    expect(screen.getByText(/Votre Réussite Scolaire/i)).toBeInTheDocument();
    expect(screen.getByText(/Avec l'Excellence Française/i)).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<HeroSection />);

    expect(screen.getByText(/L'accompagnement premium qui transforme/i)).toBeInTheDocument();
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
    expect(screen.getByText(/Coachs Agrégés/i)).toBeInTheDocument();
    expect(screen.getByText(/IA 24\/7/i)).toBeInTheDocument();
    expect(screen.getByText(/Expertise Enseignement Français/i)).toBeInTheDocument();
    expect(screen.getByText(/Spécialiste NSI/i)).toBeInTheDocument();
  });

  it('displays trust indicators', () => {
    render(<HeroSection />);

    expect(screen.getByText(/Garantie/i)).toBeInTheDocument();
    expect(screen.getByText(/Résultats/i)).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<HeroSection />);

    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1); // Le bouton principal (le link est un <a>)

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1); // Le lien vers les offres
  });

  it('renders without crashing', () => {
    expect(() => render(<HeroSection />)).not.toThrow();
  });
});
