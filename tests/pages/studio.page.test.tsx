import { render, screen } from '@testing-library/react';
import StudioPage from '@/app/studio/page';

describe('Studio page', () => {
  it('renders hero heading', () => {
    render(<StudioPage />);

    expect(
      screen.getByRole('heading', { name: /Nexus Studio : Architectes d'Intelligence Artificielle/i })
    ).toBeInTheDocument();

    const diagnosticLink = screen.getByRole('link', { name: /Planifier un diagnostic/i });
    expect(diagnosticLink).toHaveAttribute('href', '/contact?subject=Studio%20IA');

    const expertLink = screen.getAllByRole('link', { name: /Parler à un expert/i })[0];
    expect(expertLink).toHaveAttribute('href', '/contact');
  });
});
