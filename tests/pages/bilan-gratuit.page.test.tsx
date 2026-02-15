import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BilanGratuitPage from '@/app/bilan-gratuit/page';

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    button: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
      <button {...props}>{children}</button>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
  },
  Toaster: () => null,
}));

jest.mock('@/lib/analytics', () => ({
  track: {
    bilanStart: jest.fn(),
    bilanStep: jest.fn(),
    bilanSuccess: jest.fn(),
    bilanError: jest.fn(),
  },
}));

describe('Bilan gratuit page', () => {
  it('shows step 1 and validates missing fields', async () => {
    const user = userEvent.setup();
    render(<BilanGratuitPage />);

    expect(screen.getByText(/Étape 1 : Informations Parent/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Suivant/i }));

    expect(screen.getByText(/Prénom requis/i)).toBeInTheDocument();
    expect(screen.getByText(/^Nom requis$/i)).toBeInTheDocument();
  });
});
