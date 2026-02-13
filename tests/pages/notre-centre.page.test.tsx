import { render, screen } from '@testing-library/react';
import NotreCentrePage from '@/app/notre-centre/page';

describe('Notre centre page', () => {
  it('renders hero heading', () => {
    render(<NotreCentrePage />);

    expect(
      screen.getByRole('heading', { name: /Votre Campus d'Excellence à Tunis/i })
    ).toBeInTheDocument();

    const visitLink = screen.getByRole('link', { name: /Réserver ma visite guidée/i });
    expect(visitLink).toHaveAttribute('href', '#visite');

    expect(screen.getByRole('heading', { name: /L'Expérience Nexus/i })).toBeInTheDocument();
  });
});
