import { render, screen } from '@testing-library/react';

import {
  AccompagnementInclus,
  ConseillerCard,
  ProcessSteps,
  ReassuranceChips,
  Testimonials,
  TransparencyBanner,
} from '@/components/marketing/acadomia-inspired';
import socialProof from '@/content/social-proof.json';
import team from '@/content/team.json';

describe('Acadomia-inspired marketing components', () => {
  it('renders the required process copy and 24h commitment', () => {
    render(<ProcessSteps />);

    expect(screen.getByText('Bilan stratégique gratuit')).toBeInTheDocument();
    expect(screen.getByText('Recommandation de parcours')).toBeInTheDocument();
    expect(screen.getByText('Constitution du groupe & premier cours')).toBeInTheDocument();
    expect(screen.getByText('Bilans réguliers & suivi parent')).toBeInTheDocument();
    expect(screen.getByText('Réponse sous 24 h ouvrées.')).toBeInTheDocument();
  });

  it('renders the risk-reversal chips with exact approved copy', () => {
    render(<ReassuranceChips />);

    // Assert exact typographic characters: \u00A0 (NBSP) before ?, \u2019 (right single quote) for apostrophe.
    // Use normalizer:false to prevent Testing Library from collapsing NBSP to regular space.
    const noNorm = { normalizer: (s: string) => s };
    expect(screen.getByText(`Groupe non ouvert\u00A0? Acompte intégralement remboursé.`, noNorm)).toBeInTheDocument();
    expect(screen.getByText('Acompte déductible de votre parcours annuel.')).toBeInTheDocument();
    expect(screen.getByText(`Acompte reportable sur l\u2019année suivante.`, noNorm)).toBeInTheDocument();
    expect(screen.getByText('Solde réglé avant chaque prestation.')).toBeInTheDocument();
  });

  it('renders the transparency banner with exact approved copy', () => {
    render(<TransparencyBanner />);

    expect(screen.getByText('Des tarifs publics, nets, en dinars.')).toBeInTheDocument();
    expect(
      screen.getByText(/Échéanciers visibles, acompte clair, aucun coût caché/)
    ).toBeInTheDocument();
  });

  it('renders the non-nominative advisor fallback when team content is empty', () => {
    expect(team.advisors).toEqual([]);

    render(<ConseillerCard />);

    expect(screen.getByText('Un conseiller pédagogique Nexus vous répond')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('hides testimonials and ratings when social proof content is empty', () => {
    expect(socialProof.reviews).toEqual([]);
    expect(socialProof.rating).toBeNull();

    const { container } = render(<Testimonials />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the approved included-services bouquet without invented claims', () => {
    render(<AccompagnementInclus />);

    expect(
      screen.getByText("Chaque parcours Nexus, c'est plus que des heures de cours :")
    ).toBeInTheDocument();
    expect(screen.getByText('Enseignants agrégés & certifiés, spécialistes de l’épreuve')).toBeInTheDocument();
    expect(screen.getByText('Corrections sur grilles officielles & bacs blancs')).toBeInTheDocument();
    expect(screen.getByText('Accès à la plateforme ARIA')).toBeInTheDocument();
    expect(screen.getByText('Cellule Cyclades (candidats libres)')).toBeInTheDocument();
  });
});
