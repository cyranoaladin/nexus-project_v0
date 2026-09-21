import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DiagnosticsPanel } from '@/components/dashboard/core-v2/DiagnosticsPanel';

type Route = { method?: string; url: RegExp; status?: number; body: unknown | (() => unknown) };

function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.url.test(url));
    if (!route) {
      console.error('UNMATCHED_FETCH', method, url);
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }
    const status = route.status ?? 200;
    const body = typeof route.body === 'function' ? (route.body as () => unknown)() : route.body;
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ ok: true, data });

const catalogFixture = [
  {
    id: 'instr-demo',
    instrumentKey: 'DEMO-FIXTURE-01',
    version: '1.0.0',
    title: 'Diagnostic démonstration',
    subject: 'Démonstration',
    level: 'Toutes',
    targetSession: 'DEMO',
    form: 'FORM_DEMO',
    durationMinutes: 30,
    modalities: 'Fixture synthétique.',
    catalogStatus: 'DEMO_FIXTURE',
    attributionConditions: null,
  },
  {
    id: 'instr-review',
    instrumentKey: 'PILOT-EDS-MATH',
    version: '3.0.0',
    title: 'Pilote EDS-MATH',
    subject: 'Mathématiques',
    level: 'Première',
    targetSession: 'BAC2027',
    form: 'FORM_A',
    durationMinutes: 60,
    modalities: 'Pilote en revue.',
    catalogStatus: 'IN_REVIEW',
    attributionConditions: null,
  },
];

describe('DiagnosticsPanel', () => {
  afterEach(() => jest.restoreAllMocks());

  test('shows the attributable instrument and explains the non-attributable one; attributing refreshes the list', async () => {
    const user = userEvent.setup();
    let assignments: unknown[] = [];
    mockApi([
      { url: /\/staff\/diagnostics\/catalog$/, body: ok(catalogFixture) },
      { url: /\/staff\/students\/s1\/diagnostics$/, body: () => ok(assignments) },
      {
        method: 'POST',
        url: /\/staff\/students\/s1\/diagnostics$/,
        status: 201,
        body: () => {
          assignments = [
            {
              id: 'assign-1',
              status: 'ASSIGNED',
              instrumentKeySnapshot: 'DEMO-FIXTURE-01',
              instrumentVersionSnapshot: '1.0.0',
              formSnapshot: 'FORM_DEMO',
              conditionsSnapshot: null,
              dueAt: null,
              modalities: null,
              createdAt: '2026-09-21T00:00:00Z',
              instrumentRef: catalogFixture[0],
              submissions: [],
            },
          ];
          return ok(assignments[0]);
        },
      },
    ]);

    render(<DiagnosticsPanel studentId="s1" />);

    await waitFor(() => expect(screen.getByText('Aucun diagnostic attribué.')).toBeInTheDocument());
    expect(screen.getByText(/instrument.*non attribuables/i)).toBeInTheDocument();
    expect(screen.getByText(/En revue/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Attribuer un diagnostic' }));
    await user.selectOptions(screen.getByLabelText('Instrument'), 'instr-demo');
    await user.click(screen.getByRole('button', { name: 'Confirmer l’attribution' }));

    // The attribution dialog closes on success (same pattern as AddParentDialog
    // elsewhere in this codebase) — the refreshed list is the proof, not a
    // success message that unmounts with the dialog.
    await waitFor(() => expect(screen.getByText('Diagnostic démonstration')).toBeInTheDocument());
    expect(screen.getByText('Aucun dépôt reçu pour l’instant.')).toBeInTheDocument();
  });

  test('a revoked assignment shows no "Révoquer" button; an active one does', async () => {
    mockApi([
      { url: /\/staff\/diagnostics\/catalog$/, body: ok(catalogFixture) },
      {
        url: /\/staff\/students\/s1\/diagnostics$/,
        body: ok([
          {
            id: 'assign-active',
            status: 'ASSIGNED',
            instrumentKeySnapshot: 'DEMO-FIXTURE-01',
            instrumentVersionSnapshot: '1.0.0',
            formSnapshot: 'FORM_DEMO',
            conditionsSnapshot: null,
            dueAt: null,
            modalities: null,
            createdAt: '2026-09-21T00:00:00Z',
            instrumentRef: catalogFixture[0],
            submissions: [],
          },
          {
            id: 'assign-revoked',
            status: 'REVOKED',
            instrumentKeySnapshot: 'PILOT-EDS-MATH',
            instrumentVersionSnapshot: '3.0.0',
            formSnapshot: 'FORM_A',
            conditionsSnapshot: null,
            dueAt: null,
            modalities: null,
            createdAt: '2026-09-20T00:00:00Z',
            instrumentRef: catalogFixture[1],
            submissions: [],
          },
        ]),
      },
    ]);

    render(<DiagnosticsPanel studentId="s1" />);

    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Révoquer' })).toHaveLength(1));
  });
});
