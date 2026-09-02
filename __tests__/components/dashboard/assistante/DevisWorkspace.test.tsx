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

function mockFetchSequence(responses: Array<{ url: RegExp; body: unknown; ok?: boolean; waitForSignal?: Promise<void> }>) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const match = responses.find((r) => r.url.test(url));
    if (!match) throw new Error(`Unexpected fetch call: ${url}`);
    return (match.waitForSignal ?? Promise.resolve()).then(() => ({
      ok: match.ok ?? true,
      status: match.ok === false ? 400 : 200,
      json: async () => match.body,
      blob: async () => new Blob(['%PDF-mock'], { type: 'application/pdf' }),
    })) as unknown as Promise<Response>;
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
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    let releasePdfResponse!: () => void;
    const pdfResponseSignal = new Promise<void>((resolve) => {
      releasePdfResponse = resolve;
    });
    mockFetchSequence([
      {
        url: /\/api\/quotes\/leads\/search/,
        body: { leads: [{ id: 'lead-1', name: 'Jean Dupont', email: 'jean@example.com', phone: '+21699000000', status: 'NEW' }] },
      },
      { url: /\/api\/quotes\/recommend/, body: { result: { pricingVersion: 'v1', examPolicyVersion: 'v1', examSession: 2027, scenarios: [scenario] } } },
      { url: /\/api\/quotes\/margin/, body: { marginByTier: {} } },
      {
        url: /\/api\/quotes$/,
        body: {
          ok: true,
          quoteId: 'quote-1',
          token: 'raw-token',
          alreadyExisted: false,
          scenario: { ...scenario, monthlyTotal: 790, grandTotal: 7900 },
          situation: { level: 'premiere', examSession: 2027, specialites: ['MATHEMATIQUES', 'FRANCAIS'] },
          validUntil: '2027-03-01T00:00:00.000Z',
        },
      },
      { url: /\/api\/assistante\/quotes\/pdf/, body: {}, waitForSignal: pdfResponseSignal },
    ]);
    render(<DevisWorkspace />);

    await userEvent.type(screen.getByPlaceholderText(/rechercher par nom/i), 'dupont');
    const option = await screen.findByRole('button', { name: /jean dupont — jean@example\.com/i });
    await userEvent.click(option);

    await userEvent.click(screen.getByRole('button', { name: /calculer la recommandation/i }));
    await screen.findByText('RECOMMANDE');

    await userEvent.click(screen.getByRole('button', { name: /créer ce devis/i }));
    await screen.findByText(/devis créé/i);

    // The PDF must retain the lead attached at creation even if the staff
    // changes the workspace selection before downloading it.
    await userEvent.click(screen.getByRole('button', { name: /saisir un identifiant manuellement/i }));

    const pdfButton = screen.getByRole('button', { name: /télécharger le pdf/i });
    // jsdom doesn't implement createObjectURL — stub it for the download path.
    URL.createObjectURL = jest.fn(() => 'blob:mock');
    URL.revokeObjectURL = jest.fn();
    await userEvent.click(pdfButton);

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/assistante/quotes/pdf',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    const pdfCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/assistante/quotes/pdf');
    const pdfBody = JSON.parse(pdfCall[1].body);
    expect(pdfBody.publicAnnual).toBe(7900);
    expect(pdfBody.monthlyDisplay).toContain('790');
    expect(pdfBody.level).toBe('Première');
    expect(pdfBody.specialites).toEqual(['Mathématiques', 'Français']);
    expect(pdfBody.validUntil).toMatch(/01 mars 2027/i);
    expect(pdfBody.parentName).toBe('Jean Dupont');
    expect(pdfBody.email).toBe('jean@example.com');
    expect(pdfBody.whatsapp).toBe('+21699000000');
    await act(async () => {
      releasePdfResponse();
      await pdfResponseSignal;
    });
    await waitFor(() => expect(pdfButton).toBeEnabled());
  });

  test('T1 — margin gate badge uses the current nomenclature (MARGIN_OK/HUMAN_REVIEW_REQUIRED/BLOCKED), never the old GREEN/WARNING labels', async () => {
    mockFetchSequence([
      {
        url: /\/api\/quotes\/leads\/search/,
        body: { leads: [{ id: 'lead-1', name: 'Jean Dupont', email: 'jean@example.com', phone: null, status: 'NEW' }] },
      },
      { url: /\/api\/quotes\/recommend/, body: { result: { pricingVersion: 'v1', examPolicyVersion: 'v1', examSession: 2027, scenarios: [scenario] } } },
      {
        url: /\/api\/quotes\/margin/,
        body: {
          marginByTier: {
            RECOMMANDE: {
              gate: 'MARGIN_OK',
              marginPct: 45,
              annualRevenueTnd: 6200,
              annualTeachingDeliveryCostTnd: 2000,
              oneOffDossierCostTnd: 120,
              annualContributionTnd: 2790,
            },
          },
        },
      },
    ]);
    render(<DevisWorkspace />);

    await userEvent.type(screen.getByPlaceholderText(/rechercher par nom/i), 'dupont');
    const option = await screen.findByRole('button', { name: /jean dupont — jean@example\.com/i });
    await userEvent.click(option);

    await userEvent.click(screen.getByRole('button', { name: /calculer la recommandation/i }));
    await screen.findByText('RECOMMANDE');

    expect(await screen.findByText('Marge saine')).toBeInTheDocument();
  });

  test('changing a quote input invalidates the displayed calculation before creation', async () => {
    mockFetchSequence([
      { url: /\/api\/quotes\/recommend/, body: { result: { pricingVersion: 'v1', examPolicyVersion: 'v1', examSession: 2027, scenarios: [scenario] } } },
      { url: /\/api\/quotes\/margin/, body: { marginByTier: {} } },
    ]);
    render(<DevisWorkspace />);

    await userEvent.click(screen.getByRole('button', { name: /calculer la recommandation/i }));
    await screen.findByText('RECOMMANDE');

    const budgetInput = screen.getByLabelText(/budget mensuel/i);
    await userEvent.clear(budgetInput);
    await userEvent.type(budgetInput, '400');

    expect(screen.queryByText('RECOMMANDE')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /créer ce devis/i })).not.toBeInTheDocument();
  });

  test('ignores a calculation response that arrives after an input changed', async () => {
    let resolveRecommendation!: (response: Response) => void;
    const recommendationResponse = new Promise<Response>((resolve) => {
      resolveRecommendation = resolve;
    });
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url === '/api/quotes/recommend') return recommendationResponse;
      if (url === '/api/quotes/margin') {
        return Promise.resolve({ ok: true, json: async () => ({ marginByTier: {} }) } as Response);
      }
      throw new Error(`Unexpected fetch call: ${url}`);
    }) as typeof fetch;
    render(<DevisWorkspace />);

    await userEvent.click(screen.getByRole('button', { name: /calculer la recommandation/i }));
    await userEvent.clear(screen.getByLabelText(/budget mensuel/i));
    await userEvent.type(screen.getByLabelText(/budget mensuel/i), '400');

    await act(async () => {
      resolveRecommendation({
        ok: true,
        json: async () => ({
          result: { pricingVersion: 'v1', examPolicyVersion: 'v1', examSession: 2027, scenarios: [scenario] },
        }),
      } as Response);
      await recommendationResponse;
    });

    expect(screen.queryByText('RECOMMANDE')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /calculer la recommandation/i })).toBeEnabled();
  });
});
