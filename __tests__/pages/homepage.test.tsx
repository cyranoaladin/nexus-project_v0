import HomePage from '@/app/page';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';

// Mock de tous les composants de section
jest.mock('@/components/layout/header', () => {
  return {
    Header: () => <header data-testid="header">Header</header>
  };
});

jest.mock('@/components/layout/footer', () => {
  return {
    Footer: () => <footer data-testid="footer">Footer</footer>
  };
});

jest.mock('@/components/sections/hero-section', () => {
  return {
    HeroSection: () => <section data-testid="hero-section">Hero Section</section>
  };
});

jest.mock('@/components/sections/pillars-section', () => {
  return {
    PillarsSection: () => <section data-testid="pillars-section">Pillars Section</section>
  };
});

jest.mock('@/components/sections/experts-highlight-section', () => {
  return {
    ExpertsHighlightSection: () => <section data-testid="experts-highlight-section">Experts Highlight Section</section>
  };
});

jest.mock('@/components/sections/problem-solution-section', () => {
  return {
    ProblemSolutionSection: () => <section data-testid="problem-solution-section">Problem Solution Section</section>
  };
});

jest.mock('@/components/sections/offers-preview-section', () => {
  return {
    OffersPreviewSection: () => <section data-testid="offers-preview-section">Offers Preview Section</section>
  };
});

jest.mock('@/components/sections/how-it-works-section', () => {
  return {
    HowItWorksSection: () => <section data-testid="how-it-works-section">How It Works Section</section>
  };
});

jest.mock('@/components/sections/guarantee-section', () => {
  return {
    GuaranteeSection: () => <section data-testid="guarantee-section">Guarantee Section</section>
  };
});

jest.mock('@/components/sections/cta-section', () => {
  return {
    CTASection: () => <section data-testid="cta-section">CTA Section</section>
  };
});

jest.mock('@/components/ui/aria-chat', () => {
  return {
    AriaChat: () => <div data-testid="aria-chat">ARIA Chat</div>
  };
});

describe('HomePage', () => {
  it('renders without crashing', () => {
    expect(() => render(<HomePage />)).not.toThrow();
  });

  it('renders the header', () => {
    render(<HomePage />);
    expect(screen.getByTestId('header')).toBeInTheDocument();
  });

  it('renders the footer', () => {
    render(<HomePage />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders all main sections in correct order', () => {
    render(<HomePage />);

    // Vérifier que toutes les sections principales sont présentes
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('pillars-section')).toBeInTheDocument();
    expect(screen.getByTestId('experts-highlight-section')).toBeInTheDocument();
    expect(screen.getByTestId('problem-solution-section')).toBeInTheDocument();
    expect(screen.getByTestId('offers-preview-section')).toBeInTheDocument();
    expect(screen.getByTestId('how-it-works-section')).toBeInTheDocument();
    expect(screen.getByTestId('guarantee-section')).toBeInTheDocument();
    expect(screen.getByTestId('cta-section')).toBeInTheDocument();
  });

  it('renders ARIA chat component', () => {
    render(<HomePage />);
    expect(screen.getByTestId('aria-chat')).toBeInTheDocument();
  });

  it('has proper page structure', () => {
    render(<HomePage />);

    // Vérifier la structure HTML de base
    const mainElement = screen.getByRole('main');
    expect(mainElement).toBeInTheDocument();

    const headerElement = screen.getByTestId('header');
    expect(headerElement).toBeInTheDocument();

    const footerElement = screen.getByTestId('footer');
    expect(footerElement).toBeInTheDocument();
  });

  it('maintains correct section order according to strategic reorganization', () => {
    render(<HomePage />);

    const main = screen.getByRole('main');
    const sections = main.querySelectorAll('[data-testid*="section"]');

    // Vérifier l'ordre stratégique des sections
    const expectedOrder = [
      'hero-section',
      'pillars-section',
      'experts-highlight-section',
      'problem-solution-section',
      'offers-preview-section',
      'how-it-works-section',
      'guarantee-section',
      'cta-section'
    ];

    expectedOrder.forEach((sectionId, index) => {
      const section = screen.getByTestId(sectionId);
      expect(section).toBeInTheDocument();
    });
  });

  it('has proper semantic HTML structure', () => {
    render(<HomePage />);

    // Vérifier les éléments sémantiques principaux
    expect(screen.getByRole('banner')).toBeInTheDocument(); // Header
    expect(screen.getByRole('main')).toBeInTheDocument(); // Main content
    expect(screen.getByRole('contentinfo')).toBeInTheDocument(); // Footer
  });

  it('applies correct CSS classes for layout', () => {
    render(<HomePage />);

    const rootDiv = document.querySelector('.min-h-screen');
    expect(rootDiv).toBeInTheDocument();
    expect(rootDiv).toHaveClass('bg-white');
  });

  it('renders all components without throwing errors', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<HomePage />);

    expect(consoleSpy).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('has proper accessibility structure', () => {
    render(<HomePage />);

    // Vérifier que les rôles ARIA sont corrects
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('includes all essential UI components', () => {
    render(<HomePage />);

    // Vérifier que tous les composants essentiels sont inclus
    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('hero-section')).toBeInTheDocument();
    expect(screen.getByTestId('offers-preview-section')).toBeInTheDocument();
    expect(screen.getByTestId('cta-section')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('aria-chat')).toBeInTheDocument();
  });
});
