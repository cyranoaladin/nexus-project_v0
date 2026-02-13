import { render, screen } from '@testing-library/react';
import StagesPage from '@/app/stages/page';

jest.mock('@/lib/analytics', () => ({
  track: {
    stageReserve: jest.fn(),
  },
}));

describe('Stages page', () => {
  it('renders hero heading', () => {
    render(<StagesPage />);

    expect(screen.getByRole('heading', { name: /STAGES FÉVRIER/i })).toBeInTheDocument();

    const discoverLink = screen.getByRole('link', { name: /Découvrir les académies/i });
    expect(discoverLink).toHaveAttribute('href', '#academies');

    const reserveLink = screen.getByRole('link', { name: /Réserver un bilan/i });
    expect(reserveLink).toHaveAttribute('href', '#reservation');
  });
});
