import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { CanonicalConsentCard } from '@/app/dashboard/parent/enfant/[studentId]/canonical-consent-card';

const fetchMock = jest.fn();

describe('CanonicalConsentCard', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'PENDING_PARENT_CONSENT' }),
    });
    global.fetch = fetchMock;
  });

  test('loads a pending relationship without posting and requires explicit consent', async () => {
    const user = userEvent.setup();

    render(<CanonicalConsentCard studentId="student-1" />);

    expect(screen.getByRole('status')).toHaveTextContent('Vérification du rattachement');

    const consent = await screen.findByRole('checkbox', {
      name: /j’atteste avoir donné mon consentement explicite/i,
    });
    const submit = screen.getByRole('button', { name: /confirmer le rattachement/i });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/parent/children/student-1/canonical-consent',
      { method: 'GET' },
    );
    expect(consent).not.toBeChecked();
    expect(submit).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);

    await user.click(consent);

    expect(consent).toBeChecked();
    expect(screen.getByRole('button', { name: /confirmer le rattachement/i })).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  test('shows an existing verified relationship without requesting consent again', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'VERIFIED' }),
    });

    render(<CanonicalConsentCard studentId="student-1" />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Rattachement vérifié');
    });
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  test.each(['REVOKED', 'EXPIRED', 'MISSING'])(
    'allows a new explicit consent from the %s state without posting on load',
    async (state) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ state }),
      });

      render(<CanonicalConsentCard studentId="student-1" />);

      const consent = await screen.findByRole('checkbox', {
        name: /j’atteste avoir donné mon consentement explicite/i,
      });
      expect(consent).not.toBeChecked();
      expect(screen.getByRole('button', { name: /confirmer le rattachement/i })).toBeDisabled();
      expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
    },
  );

  test('fails closed on an unknown relationship state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ state: 'UNEXPECTED_STATE' }),
    });

    render(<CanonicalConsentCard studentId="student-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le rattachement ne peut pas être vérifié pour le moment. Veuillez réessayer plus tard.',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  test('fails closed when the current relationship cannot be loaded', async () => {
    fetchMock.mockRejectedValue(new Error('temporary'));

    render(<CanonicalConsentCard studentId="student-1" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le rattachement ne peut pas être vérifié pour le moment. Veuillez réessayer plus tard.',
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /confirmer le rattachement/i })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0);
  });

  test('posts the exact consent payload and displays the verified state', async () => {
    const user = userEvent.setup();
    let resolvePost: ((response: unknown) => void) | undefined;
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'PENDING_PARENT_CONSENT' }),
      })
      .mockImplementationOnce(
        () => new Promise((resolve) => {
          resolvePost = resolve;
        }),
      );

    render(<CanonicalConsentCard studentId="student-1" />);

    await user.click(
      await screen.findByRole('checkbox', {
        name: /j’atteste avoir donné mon consentement explicite/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /confirmer le rattachement/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Enregistrement du consentement');
    resolvePost?.({
      ok: true,
      json: async () => ({ state: 'VERIFIED' }),
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/parent/children/student-1/canonical-consent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ consent: true }),
        }),
      );
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Rattachement vérifié');
    });
  });

  test('keeps the relationship unverified and shows a restrained error on failure', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ state: 'PENDING_PARENT_CONSENT' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'INTERNAL_DETAILS_MUST_NOT_LEAK' }),
      });

    render(<CanonicalConsentCard studentId="student-1" />);

    await user.click(
      await screen.findByRole('checkbox', {
        name: /j’atteste avoir donné mon consentement explicite/i,
      }),
    );
    await user.click(screen.getByRole('button', { name: /confirmer le rattachement/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le rattachement n’a pas pu être vérifié. Veuillez réessayer.',
    );
    expect(screen.queryByText(/rattachement vérifié/i)).not.toBeInTheDocument();
    expect(screen.queryByText('INTERNAL_DETAILS_MUST_NOT_LEAK')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirmer le rattachement/i })).toBeEnabled();
  });
});
