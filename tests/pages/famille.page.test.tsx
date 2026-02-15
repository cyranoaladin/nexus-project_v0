import { render, screen } from '@testing-library/react';
import FamillePage from '@/app/famille/page';

describe('Famille page', () => {
  it('renders hero heading', () => {
    render(<FamillePage />);

    expect(
      screen.getByRole('heading', { name: /La mention au Bac, enfin à portée de main/i })
    ).toBeInTheDocument();

    const bilanLink = screen.getAllByRole('link', { name: /Démarrer un bilan gratuit/i })[0];
    expect(bilanLink).toHaveAttribute('href', '/bilan-gratuit');

    const equipeLink = screen.getByRole('link', { name: /Découvrir nos profs Agrégés et Certifiés/i });
    expect(equipeLink).toHaveAttribute('href', '/equipe');
  });
});
