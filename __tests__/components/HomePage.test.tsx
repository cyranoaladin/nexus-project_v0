import { render, screen } from '@testing-library/react';
import HomePage, { metadata } from '@/app/page';

describe('HomePage', () => {
  it('renders the static marketing homepage without crashing', () => {
    const { container } = render(<HomePage />);

    expect(container.firstChild).not.toBeNull();
    expect(container.querySelector('footer')).toBeInTheDocument();
    expect(screen.getAllByAltText('Nexus Réussite').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /viser\. atteindre\. dépasser\./i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /trouvez la formule adaptée à votre enfant/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /demander un bilan gratuit/i })).toHaveAttribute('href', '/bilan-gratuit');
  });

  it('exports homepage metadata', () => {
    expect(metadata.title).toBeDefined();
    expect(typeof metadata.title).toBe('string');
    expect(metadata.description).toBeDefined();
  });
});
