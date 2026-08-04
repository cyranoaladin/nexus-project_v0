import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { LogoutButton } from '@/components/navigation/LogoutButton';

const logoutActionMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@/lib/auth/logout-action', () => ({
  logoutAction: (...args: unknown[]) => logoutActionMock(...args),
}));

describe('LogoutButton', () => {
  beforeEach(() => {
    logoutActionMock.mockReset();
    logoutActionMock.mockResolvedValue(undefined);
  });

  it('delegates session invalidation and redirect to the canonical server action', async () => {
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter de votre compte' }));

    await waitFor(() => {
      expect(logoutActionMock).toHaveBeenCalledTimes(1);
    });
  });
});
