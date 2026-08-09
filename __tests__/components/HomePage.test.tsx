import { render, screen } from '@testing-library/react';
import HomePage, { metadata } from '@/app/page';

describe('HomePage', () => {
  it('renders the static marketing homepage without crashing', () => {
    const { container } = render(<HomePage />);

    expect(container.firstChild).not.toBeNull();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(screen.getAllByAltText('Nexus Réussite').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /préparer le bac français avec méthode, suivi et exigence/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trouvez la formule adaptée à votre enfant/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Passer le bilan de pré-rentrée' })).toHaveAttribute(
      'href',
      '/bilan-gratuit?parcours=diagnostic#demande-bilan',
    );
    expect(screen.getByRole('link', { name: 'Être rappelé par un conseiller' })).toHaveAttribute(
      'href',
      '/bilan-gratuit?parcours=conseiller#rappel-conseiller',
    );
  });

  it('exports homepage metadata', () => {
    expect(metadata.title).toBeDefined();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.description).toBeDefined();
  });
});
