import OffresPage from '@/app/offres/page';
import { render, screen } from '@testing-library/react';

// Mock Next.js Link component
jest.mock('next/link', () => {
  return function MockLink({ children, href, ...props }: any) {
    return <a href={href} {...props}>{children}</a>;
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: () => ({ get: () => 1 }),
}));

// Mock les composants
jest.mock('@/components/layout/header', () => ({
  Header: () => <header data-testid="header">Header</header>,
}));

jest.mock('@/components/layout/footer', () => ({
  Footer: () => <footer data-testid="footer">Footer</footer>,
}));

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
  beforeEach(() => {
    render(<OffresPage />);
  });

  describe('Rendu initial', () => {
    it('affiche le header et footer', () => {
      expect(screen.getByTestId('header')).toBeInTheDocument();
      expect(screen.getByTestId('footer')).toBeInTheDocument();
    });

    it('affiche le titre principal', () => {
      expect(screen.getByText('Pilotez Votre Réussite')).toBeInTheDocument();
    });

    it('affiche le sous-titre', () => {
      expect(screen.getByText('La Stratégie, l\'Expertise, la Mention.')).toBeInTheDocument();
    });

    it('affiche les boutons de navigation rapide', () => {
      expect(screen.getByText('Nexus Cortex')).toBeInTheDocument();
      expect(screen.getByText('Académies')).toBeInTheDocument();
      expect(screen.getByText('Programme Odyssée')).toBeInTheDocument();
    });
  });

  describe('Sections principales', () => {
    it('affiche la section Analyse Stratégique Différentielle', () => {
      expect(screen.getByText('Deux Réalités, Deux Réponses Sur-Mesure')).toBeInTheDocument();
      expect(screen.getByText('L\'Élève Scolarisé (AEFE)')).toBeInTheDocument();
      expect(screen.getByText('Le Candidat Libre')).toBeInTheDocument();
    });

    it('affiche la section Nexus Cortex', () => {
      expect(screen.getByText('Univers 1 : Nexus Cortex')).toBeInTheDocument();
      expect(screen.getByText('L\'IA Entraînée pour le Bac Français')).toBeInTheDocument();
      expect(screen.getByText('ARIA Essentiel')).toBeInTheDocument();
      expect(screen.getByText('ARIA+ Premium')).toBeInTheDocument();
    });

    it('affiche la section Académies', () => {
      expect(screen.getByText('Univers 2 : Les Académies Nexus')).toBeInTheDocument();
      expect(screen.getByText('Les Sprints de Performance')).toBeInTheDocument();
      expect(screen.getByText('Académie de la Toussaint')).toBeInTheDocument();
      expect(screen.getByText('Académie de Noël')).toBeInTheDocument();
    });

    it('affiche la section Programme Odyssée', () => {
      expect(screen.getByText('Univers 3 : Le Programme Odyssée')).toBeInTheDocument();
      expect(screen.getByText('L\'Accompagnement Annuel d\'Excellence')).toBeInTheDocument();
      expect(screen.getByText('Odyssée Première')).toBeInTheDocument();
      expect(screen.getByText('Odyssée Terminale')).toBeInTheDocument();
      expect(screen.getByText('Odyssée Individuel')).toBeInTheDocument();
    });
  });

  describe('Composants intégrés', () => {
    it('affiche le composant FloatingNav', () => {
      expect(screen.getByTestId('floating-nav')).toBeInTheDocument();
    });

    it('affiche le composant OffersComparison', () => {
      expect(screen.getByTestId('offers-comparison')).toBeInTheDocument();
    });

    it('affiche le composant TestimonialsSection', () => {
      expect(screen.getByTestId('testimonials-section')).toBeInTheDocument();
    });

    it('affiche le composant GuaranteeSection', () => {
      expect(screen.getByTestId('guarantee-section')).toBeInTheDocument();
    });

    it('affiche le composant FAQSection', () => {
      expect(screen.getByTestId('faq-section')).toBeInTheDocument();
    });

    it('affiche le composant DiagnosticForm', () => {
      expect(screen.getByTestId('diagnostic-form')).toBeInTheDocument();
    });
  });

  describe('Navigation et liens', () => {
    it('a des liens vers les sections avec des ancres', () => {
      const cortexLink = screen.getByText('Nexus Cortex').closest('a');
      const academiesLink = screen.getByText('Académies').closest('a');
      const odysseeLink = screen.getByText('Programme Odyssée').closest('a');

      expect(cortexLink).toHaveAttribute('href', '#cortex');
      expect(academiesLink).toHaveAttribute('href', '#academies');
      expect(odysseeLink).toHaveAttribute('href', '#odyssee');
    });

    it('a des sections avec les bonnes IDs', () => {
      const cortexSection = document.querySelector('#cortex');
      const academiesSection = document.querySelector('#academies');
      const odysseeSection = document.querySelector('#odyssee');

      expect(cortexSection).toBeInTheDocument();
      expect(academiesSection).toBeInTheDocument();
      expect(odysseeSection).toBeInTheDocument();
    });
  });

  describe('Boutons et CTAs', () => {
    it('a des boutons CTA dans chaque section', () => {
      const ctaButtons = screen.getAllByText(/Découvrir|Commencer|Réserver|Démarrer|Demander/);
      expect(ctaButtons.length).toBeGreaterThan(0);
    });

    it('a des boutons avec les bonnes classes CSS', () => {
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveClass('inline-flex');
        expect(button).toHaveClass('items-center');
        expect(button).toHaveClass('justify-center');
      });
    });
  });

  describe('Prix et offres', () => {
    it('affiche les prix correctement', () => {
      expect(screen.getByText('90 TND/mois')).toBeInTheDocument();
      expect(screen.getByText('750 TND')).toBeInTheDocument();
      expect(screen.getByText('6500 TND/an')).toBeInTheDocument();
      expect(screen.getByText('8000 TND/an')).toBeInTheDocument();
    });

    it('affiche les badges "Plus Populaire"', () => {
      const popularBadges = screen.getAllByText('Plus Populaire');
      expect(popularBadges.length).toBeGreaterThan(0);
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
