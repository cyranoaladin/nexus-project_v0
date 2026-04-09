import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import ActivatePage from '@/app/auth/activate/page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => null,
}));

describe('ActivatePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
  });

  it('renders an invalid-link state when search params are unavailable', async () => {
    render(<ActivatePage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /lien invalide/i })).toBeInTheDocument();
    });

    expect(screen.getByText(/token manquant/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
