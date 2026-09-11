import { render, screen } from '@testing-library/react';
import { HeroSection } from '@/components/premium/HeroSection';

describe('Institutional homepage hero', () => {
  it('uses the existing classroom illustration instead of the expired August campaign image', () => {
    const { container } = render(<HeroSection />);
    const image = screen.getByRole('img', { name: 'Illustration d’un cours en petit groupe' });
    expect(image).toHaveAttribute('src', '/images/nexus-select.webp');
    expect(container.querySelector('img[src="/hero/hero.webp"]')).toBeNull();
    expect(screen.queryByAltText(/pré.?rentrée|août 2026/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Trouver ma formule/ })).toHaveAttribute('href', '/recommandation');
    expect(screen.getByRole('link', { name: /Voir les offres/ })).toHaveAttribute('href', '/offres');
  });
});
