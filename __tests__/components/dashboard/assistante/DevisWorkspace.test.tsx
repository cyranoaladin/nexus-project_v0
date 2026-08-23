import '@testing-library/jest-dom';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DevisWorkspace } from '@/components/dashboard/assistante/DevisWorkspace';

const scenario = {
  tier: 'RECOMMANDE',
  lines: [
    {
      subject: 'eds1',
      label: 'Mathématiques',
      modality: 'GROUPE',
      hoursPerMonth: 8,
      unitPriceMonthly: 470,
      priorityScore: 100,
      priorityLabel: 'haute',
      reason: 'test',
    },
  ],
  notRecommended: [],
  monthlyTotal: 620,
  grandTotal: 6200,
  months: 10,
  matchedOfferId: null,
};

function mockFetchSequence(responses: Array<{ url: RegExp; body: unknown; ok?: boolean }>) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = responses.find((r) => r.url.test(url));
    if (!match) throw new Error(`Unexpected fetch call: ${url}`);
    return Promise.resolve({
      ok: match.ok ?? true,
      status: match.ok === false ? 400 : 200,
      json: async () => match.body,
      blob: async () => new Blob(['%PDF-mock'], { type: 'application/pdf' }),
    }) as unknown as Promise<Response>;
  }) as unknown as typeof fetch;
}

describe('DevisWorkspace', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('typing 2+ characters triggers a lead search; selecting a result fills the lead field', async () => {
    mockFetchSequence([
      {
        url: /\/api\/quotes\/leads\/search/,
        body: { leads: [{ id: 'lead-1', name: 'Jean Dupont', email: 'jean@example.com', phone: null, status: 'NEW' }] },
      },
    ]);
    render(<DevisWorkspace />);

    const searchInput = screen.getByPlaceholderText(/rechercher par nom/i);
    await userEvent.type(searchInput, 'dupont');

    const option = await screen.findByRole('button', { name: /jean dupont — jean@example\.com/i });
    await userEvent.click(option);

    expect(screen.getByText(/jean dupont — jean@example\.com/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/rechercher par nom/i)).not.toBeInTheDocument();
  });

  test('after a quote is created, a PDF download button appears and posts to the PDF endpoint', async () => {
    mockFetchSequence([
      {
        url: /\/api\/quotes\/leads\/search/,
        body: { leads: [{ id: 'lead-1', name: 'Jean Dupont', email: 'jean@example.com', phone: '+21699000000', status: 'NEW' }] },
      },
      { url: /\/api\/quotes\/recommend/, body: { result: { pricingVersion: 'v1', examPolicyVersion: 'v1', examSession: 2027, scenarios: [scenario] } } },
      { url: /\/api\/quotes\/margin/, body: { marginByTier: {} } },
      { url: /\/api\/quotes$/, body: { ok: true, quoteId: 'quote-1', token: 'raw-token', alreadyExisted: false } },
      { url: /\/api\/assistante\/quotes\/pdf/, body: {} },
    ]);
    render(<DevisWorkspace />);

    await userEvent.type(screen.getByPlaceholderText(/rechercher par nom/i), 'dupont');
    const option = await screen.findByRole('button', { name: /jean dupont — jean@example\.com/i });
    await userEvent.click(option);

    await userEvent.click(screen.getByRole('button', { name: /calculer la recommandation/i }));
    await screen.findByText('RECOMMANDE');

    await userEvent.click(screen.getByRole('button', { name: /créer ce devis/i }));
    await screen.findByText(/devis créé/i);

    const pdfButton = screen.getByRole('button', { name: /télécharger le pdf/i });
    // jsdom doesn't implement createObjectURL — stub it for the download path.
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    await act(async () => {
      await userEvent.click(pdfButton);
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assistante/quotes/pdf',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });
});
