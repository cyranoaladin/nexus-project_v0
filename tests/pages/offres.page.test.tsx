import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OffresPage from '@/app/offres/page';

jest.mock('@/lib/analytics', () => ({
  track: {
    offerView: jest.fn(),
    quizComplete: jest.fn(),
  },
}));

describe('Offres page', () => {
  it('renders hero and primary CTA', () => {
    render(<OffresPage />);

    expect(
      screen.getByRole('heading', { name: /Investissez dans la seule garantie de réussite au Bac/i })
    ).toBeInTheDocument();

    const main = screen.getByRole('main');
    const bilanLinks = within(main).getAllByRole('link', { name: /Démarrer un bilan gratuit/i });
    expect(bilanLinks[0]).toHaveAttribute('href', '/bilan-gratuit');
  });

  it('advances quiz to second step', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<OffresPage />);

    expect(
      screen.getByRole('heading', { name: /Trouvez la solution parfaite en 2 minutes/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Scolarisé en lycée français/i }));
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Son objectif principal est/i)).toBeInTheDocument();
    jest.useRealTimers();
  });
});
