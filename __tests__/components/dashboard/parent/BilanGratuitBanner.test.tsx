import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BilanGratuitBanner } from '@/components/dashboard/BilanGratuitBanner';

function mockFetchStatus(body: { completed: boolean; dismissed: boolean }) {
  global.fetch = jest.fn().mockResolvedValue({
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('BilanGratuitBanner', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('does not render when the parent already completed a bilan', async () => {
    mockFetchStatus({ completed: true, dismissed: false });
    render(<BilanGratuitBanner onGoToChildren={jest.fn()} />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.queryByText(/complétez le bilan diagnostic gratuit/i)).not.toBeInTheDocument();
  });

  test('calls onGoToChildren instead of navigating to the public registration form', async () => {
    mockFetchStatus({ completed: false, dismissed: false });
    const onGoToChildren = jest.fn();
    render(<BilanGratuitBanner onGoToChildren={onGoToChildren} />);

    const cta = await screen.findByRole('button', { name: /ajouter votre enfant/i });
    // The whole point of this fix: an already-authenticated parent must be
    // routed to their own "Ajouter un Enfant" flow, never back to the
    // anonymous public /bilan-gratuit registration form (dead end for an
    // existing account -- silent no-op success on their own email).
    expect(cta.closest('a')).toBeNull();

    await userEvent.click(cta);
    expect(onGoToChildren).toHaveBeenCalledTimes(1);
  });

  test('guide vers le lien existant sans proposer de créer un doublon', async () => {
    mockFetchStatus({ completed: false, dismissed: false });
    render(<BilanGratuitBanner hasChildren onGoToChildren={jest.fn()} />);

    expect(await screen.findByRole('button', { name: /voir le lien de votre enfant/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ajouter votre enfant/i })).not.toBeInTheDocument();
  });
});
