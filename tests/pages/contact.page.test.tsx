import { render, screen, within } from '@testing-library/react';
import ContactPage from '@/app/contact/page';

describe('Contact page', () => {
  it('renders primary hero copy and CTAs', () => {
    render(<ContactPage />);

    expect(
      screen.getByRole('heading', { name: /Votre première question mérite une réponse d'expert/i })
    ).toBeInTheDocument();

    const main = screen.getByRole('main');
    const bilanLink = within(main).getByRole('link', { name: /Démarrer un bilan gratuit/i });
    expect(bilanLink).toHaveAttribute('href', '/bilan-gratuit');

    const offresLink = within(main).getAllByRole('link', { name: /Voir les offres/i })[0];
    expect(offresLink).toHaveAttribute('href', '/offres');

    expect(screen.getByRole('heading', { name: /Contact direct/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /FAQ rapide/i })).toBeInTheDocument();
  });
});
