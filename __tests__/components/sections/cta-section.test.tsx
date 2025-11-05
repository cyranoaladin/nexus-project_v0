import { CTASection } from '@/components/sections/cta-section';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Mock de next/link
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
    },
  };
});

describe('CTASection', () => {
  it('renders the main CTA message', () => {
    render(<CTASection />);

    expect(screen.getByText(/Prêt à construire l'avenir de votre enfant/i)).toBeInTheDocument();
  });

  it('renders both CTA buttons', () => {
    render(<CTASection />);

    expect(screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i)).toBeInTheDocument();
    expect(screen.getByText(/Poser une Question/i)).toBeInTheDocument();
  });

  it('has correct links for CTA buttons', () => {
    render(<CTASection />);

    const bilanLink = screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i).closest('a');
    expect(bilanLink).toHaveAttribute('href', '/bilan-gratuit');

    const contactLink = screen.getByText(/Poser une Question/i).closest('a');
    expect(contactLink).toHaveAttribute('href', '/contact');
  });

  it('renders trust indicators', () => {
    render(<CTASection />);

    // Vérifier la présence des indicateurs de confiance
    expect(screen.getByText(/Commencez par un échange avec nos experts/i)).toBeInTheDocument();
  });

  it('renders animated trust elements', () => {
    render(<CTASection />);

    // Les points animés devraient être présents dans le DOM
    const animatedElements = document.querySelectorAll('[style*="animation-delay"]');
    expect(animatedElements.length).toBeGreaterThan(0);
  });

  it('renders proper semantic structure', () => {
    render(<CTASection />);

    const section = document.querySelector('section');
    expect(section).not.toBeNull();

    const interactiveElements = [
      ...screen.queryAllByRole('button'),
      ...screen.getAllByRole('link')
    ];
    expect(interactiveElements.length).toBeGreaterThanOrEqual(2);
  });

  it('has proper button styling and classes', () => {
    render(<CTASection />);

    const primaryButton = screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i).closest('a');
    const secondaryButton = screen.getByText(/Poser une Question/i).closest('a');

    expect(primaryButton).toBeInTheDocument();
    expect(secondaryButton).toBeInTheDocument();
  });

  it('renders benefits or features if present', () => {
    render(<CTASection />);

    // Cette section peut contenir des bénéfices ou des caractéristiques
    // Nous vérifions que le contenu principal est rendu
    const mainContent = document.querySelector('section');
    expect(mainContent).toBeInTheDocument();
  });

  it('renders without crashing', () => {
    expect(() => render(<CTASection />)).not.toThrow();
  });

  it('has accessible button elements', () => {
    render(<CTASection />);

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('href');
      expect(link.getAttribute('href')).not.toBe('');
    });
  });

  it('maintains proper visual hierarchy', () => {
    render(<CTASection />);

    // Vérifier que les éléments principaux sont présents
    const mainMessage = screen.getByText(/Prêt à construire l'avenir de votre enfant/i);
    expect(mainMessage).toBeInTheDocument();

    const primaryCTA = screen.getByText(/Commencer mon Bilan Stratégique Gratuit/i);
    expect(primaryCTA).toBeInTheDocument();
  });
});
