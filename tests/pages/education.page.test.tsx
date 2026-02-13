import { render, screen } from '@testing-library/react';
import EducationPage from '@/app/education/page';

describe('Education page', () => {
  it('renders hero heading', () => {
    render(<EducationPage />);

    expect(screen.getByRole('heading', { name: /L'Accompagnement/i })).toBeInTheDocument();

    const bilanLink = screen.getAllByRole('link', { name: /Démarrer un bilan gratuit/i })[0];
    expect(bilanLink).toHaveAttribute('href', '/bilan-gratuit');

    const expertLink = screen.getAllByRole('link', { name: /Parler à un expert/i })[0];
    expect(expertLink).toHaveAttribute('href', '/contact');
  });
});
