import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LogoutButton } from '@/components/navigation/LogoutButton';

const signOutMock = jest.fn().mockResolvedValue(undefined);

jest.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => signOutMock(...args),
}));

describe('LogoutButton', () => {
  beforeEach(() => {
    signOutMock.mockReset();
    signOutMock.mockResolvedValue(undefined);
  });

  it('delegates session invalidation and redirect to the canonical server action', async () => {
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter de votre compte' }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/' });
    });
  });
});
