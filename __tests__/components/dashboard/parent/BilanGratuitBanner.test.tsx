import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
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
    jest.useRealTimers();
  });

  test('consumes the dismissal acknowledgement before hiding the banner', async () => {
    let confirm!: (body: { dismissed: boolean }) => void;
    const json = jest.fn(() => new Promise(resolve => { confirm = resolve; }));
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ completed: false, dismissed: false }) })
      .mockResolvedValueOnce({ ok: true, json });
    render(<BilanGratuitBanner onGoToChildren={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Fermer la bannière' }));
    await waitFor(() => expect(json).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('heading')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fermer la bannière' })).toBeDisabled();
    confirm({ dismissed: true });
    await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
  });

  test.each(['network', 'http', 'invalid acknowledgement'])('keeps an actionable banner after %s failure', async failure => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({ completed: false, dismissed: false }) });
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new Error('Unavailable'));
    else fetchMock.mockResolvedValueOnce({ ok: failure !== 'http', json: async () => ({ dismissed: failure === 'http' }) });
    global.fetch = fetchMock;
    render(<BilanGratuitBanner onGoToChildren={jest.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Fermer la bannière' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de fermer la bannière');
    expect(screen.getByRole('heading')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Fermer la bannière' })).toBeEnabled();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ dismissed: true }) });
    await userEvent.click(screen.getByRole('button', { name: 'Fermer la bannière' }));
    await waitFor(() => expect(screen.queryByRole('heading')).not.toBeInTheDocument());
  });

  test('bounds a pending acknowledgement and restores the retry action', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ json: async () => ({ completed: false, dismissed: false }) })
      .mockImplementationOnce((_url, options) => Promise.resolve({
        ok: true,
        json: () => new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
      }));
    render(<BilanGratuitBanner onGoToChildren={jest.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'Fermer la bannière' }));
    expect(screen.getByRole('button', { name: 'Fermer la bannière' })).toBeDisabled();
    await act(async () => { jest.advanceTimersByTime(10_000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Impossible de fermer la bannière');
    expect(screen.getByRole('button', { name: 'Fermer la bannière' })).toBeEnabled();
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

    const cta = await screen.findByRole('button', { name: /demander l.?ajout de votre enfant/i });
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
    expect(screen.queryByRole('button', { name: /demander l.?ajout de votre enfant/i })).not.toBeInTheDocument();
  });
});
