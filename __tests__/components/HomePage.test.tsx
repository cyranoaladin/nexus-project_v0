import { render, screen } from '@testing-library/react';
import HomePage, { metadata } from '@/app/page';

jest.mock('@/components/layout/CorporateNavbar', () => ({
  CorporateNavbar: () => <div data-testid="navbar">Navbar</div>,
}));
jest.mock('@/components/layout/CorporateFooter', () => ({
  CorporateFooter: () => <div data-testid="footer">Footer</div>,
}));

describe('HomePage', () => {
  it('renders the new homepage hub sections and flagship links', () => {
    render(<HomePage />);

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /nexus réussite,/i })).toBeInTheDocument();
    expect(screen.getByText(/la dernière ligne droite vers la mention/i)).toBeInTheDocument();
    expect(screen.getByText(/l'ia qui t'entraîne sans jamais rédiger à ta place/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Première' })).toBeInTheDocument();
    expect(screen.getByText(/ils ont transformé leurs résultats/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /découvrir les stages printemps/i })[0]).toHaveAttribute('href', '/stages');
    expect(screen.getAllByRole('link', { name: /essayer la plateforme eaf gratuitement/i })[0]).toHaveAttribute(
      'href',
      'https://eaf.nexusreussite.academy'
    );
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('exports homepage metadata for the two-offer hub', () => {
    expect(metadata.title).toBe('Nexus Réussite — Stages Printemps 2026 & Préparation EAF | Tunis');
    expect(metadata.description).toContain('Stages intensifs Première & Terminale');
  });
});
