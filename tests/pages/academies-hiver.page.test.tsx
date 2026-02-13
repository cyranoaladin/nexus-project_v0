import { render, screen } from '@testing-library/react';
import AcademiesHiverPage from '@/app/academies-hiver/page';

describe('Academies hiver page', () => {
  it('renders hero heading', () => {
    render(<AcademiesHiverPage />);

    expect(screen.getByRole('heading', { name: /STAGES FÉVRIER/i })).toBeInTheDocument();

    const discoverLink = screen.getByRole('link', { name: /Découvrir les académies/i });
    expect(discoverLink).toHaveAttribute('href', '#academies');

    const reserveLink = screen.getByRole('link', { name: /Réserver un bilan/i });
    expect(reserveLink).toHaveAttribute('href', '#reservation');
  });
});
