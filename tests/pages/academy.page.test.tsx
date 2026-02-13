import { render, screen } from '@testing-library/react';
import AcademyPage from '@/app/academy/page';

describe('Academy page', () => {
  it('renders hero heading', () => {
    render(<AcademyPage />);

    expect(
      screen.getByRole('heading', { name: /Nexus Academy : Formez les élites de demain/i })
    ).toBeInTheDocument();

    const catalogueLink = screen.getByRole('link', { name: /Découvrir le catalogue/i });
    expect(catalogueLink).toHaveAttribute('href', '/contact?subject=Catalogue%20Academy');

    const demanderLink = screen.getByRole('link', { name: /Demander le catalogue/i });
    expect(demanderLink).toHaveAttribute('href', '/contact?subject=Catalogue%20Academy');

    const expertLink = screen.getAllByRole('link', { name: /Parler à un expert/i })[0];
    expect(expertLink).toHaveAttribute('href', '/contact');
  });
});
