import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { DiagnosticsQueueWorkspace } from '@/components/dashboard/core-v2/DiagnosticsQueueWorkspace';

type Route = { method?: string; url: RegExp; status?: number; body: unknown };

function mockApi(routes: Route[]) {
  const calls: string[] = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push(url);
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.url.test(url));
    if (!route) { console.error('UNMATCHED_FETCH', method, url); throw new Error(`Unexpected fetch ${method} ${url}`); }
    const status = route.status ?? 200;
    return { ok: status < 400, status, json: async () => route.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ ok: true, data });
const fail = (code: string, message: string) => ({ ok: false, error: { code, message }, correlationId: 'c-1' });
const me = (capabilities: string[]) => ok({ actor: { userId: 'staff-1', role: 'ADMIN' }, capabilities });

const row = (id: string, state: string, first: string) => ({
  submissionId: id,
  state,
  candidate: { id: `student-${id}`, firstName: first, lastName: 'Synthetic' },
  instrument: { instrumentKey: 'DEMO-FIXTURE-01', version: '2.0.0', title: 'Instrument démo' },
  submission: { version: 1, status: 'RECEIVED', createdAt: '2026-09-20T10:00:00Z' },
  processingStatus: null,
  draftStatus: null,
  lastActivityAt: '2026-09-20T10:00:00Z',
});

describe('DiagnosticsQueueWorkspace', () => {
  afterEach(() => jest.restoreAllMocks());

  test('empty state for the default ACTION_REQUIRED filter, then switching filter re-fetches with the new status', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      { url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/, body: ok({ items: [], nextCursor: null, listChanged: false }) },
      { url: /\/staff\/diagnostics\/submissions\?status=PUBLISHED&limit=20$/, body: ok({ items: [row('s1', 'PUBLISHED', 'Léa')], nextCursor: null, listChanged: false }) },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText(/Aucune copie ne nécessite d’action/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Publié' }));
    expect(await screen.findByText('Léa Synthetic')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir la copie de Léa Synthetic' })).toHaveAttribute(
      'href',
      '/dashboard/admin/diagnostics-candidat-libre/s1',
    );
  });

  test('lists rows for the default filter with their state badge and links to the canonical detail route', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/,
        body: ok({ items: [row('s1', 'NOT_PROCESSED', 'Yanis'), row('s2', 'READY_FOR_REVIEW', 'Nora')], nextCursor: null, listChanged: false }),
      },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText('Yanis Synthetic')).toBeInTheDocument();
    expect(screen.getByText('Nora Synthetic')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Non traité')).toBeInTheDocument();
    expect(within(table).getByText('Prêt pour revue')).toBeInTheDocument();
  });

  test('a server error surfaces as an alert, not a silent empty state', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      { url: /\/staff\/diagnostics\/submissions/, status: 500, body: fail('INTERNAL', 'Erreur serveur inattendue.') },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur serveur inattendue.');
  });

  test('a staff member without DIAGNOSTIC_SUBMISSION_TRACK sees an explicit no-permission message, never the table', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me([]) },
      { url: /\/staff\/diagnostics\/submissions/, body: ok({ items: [row('s1', 'PUBLISHED', 'Léa')], nextCursor: null }) },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);
    expect(await screen.findByText(/n’avez pas les droits nécessaires/)).toBeInTheDocument();
    expect(screen.queryByText('Léa Synthetic')).not.toBeInTheDocument();
  });

  test('a listChanged load-more response replaces existing rows and announces the refresh', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/,
        body: ok({ items: [row('old', 'NOT_PROCESSED', 'Ancienne')], nextCursor: 'cursor-1', listChanged: false }),
      },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20&cursor=cursor-1$/,
        body: ok({ items: [row('fresh', 'READY_FOR_REVIEW', 'Nouvelle')], nextCursor: null, listChanged: true }),
      },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText('Ancienne Synthetic')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));

    expect(await screen.findByText('Nouvelle Synthetic')).toBeInTheDocument();
    expect(screen.queryByText('Ancienne Synthetic')).not.toBeInTheDocument();
    expect(screen.getByText('Liste actualisée')).toBeInTheDocument();
  });

  test('overlapping pages render each submission once and preserve server order', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/,
        body: ok({
          items: [row('s1', 'NOT_PROCESSED', 'Première'), row('s2', 'READY_FOR_REVIEW', 'Deuxième')],
          nextCursor: 'cursor-2',
          listChanged: false,
        }),
      },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20&cursor=cursor-2$/,
        body: ok({
          items: [row('s2', 'READY_FOR_REVIEW', 'Deuxième'), row('s3', 'FAILED', 'Troisième')],
          nextCursor: null,
          listChanged: false,
        }),
      },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText('Première Synthetic')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(await screen.findByText('Troisième Synthetic')).toBeInTheDocument();

    expect(screen.getAllByText('Deuxième Synthetic')).toHaveLength(1);
    expect(within(screen.getByRole('table')).getAllByRole('link').map((link) => link.getAttribute('aria-label'))).toEqual([
      'Ouvrir la copie de Première Synthetic',
      'Ouvrir la copie de Deuxième Synthetic',
      'Ouvrir la copie de Troisième Synthetic',
    ]);
  });

  test('a new first page replaces rows from the previous filter', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/,
        body: ok({ items: [row('action', 'NOT_PROCESSED', 'Action')], nextCursor: null, listChanged: false }),
      },
      {
        url: /\/staff\/diagnostics\/submissions\?status=PUBLISHED&limit=20$/,
        body: ok({ items: [row('published', 'PUBLISHED', 'Publiée')], nextCursor: null, listChanged: false }),
      },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText('Action Synthetic')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publié' }));

    expect(await screen.findByText('Publiée Synthetic')).toBeInTheDocument();
    expect(screen.queryByText('Action Synthetic')).not.toBeInTheDocument();
    expect(screen.queryByText('Liste actualisée')).not.toBeInTheDocument();
  });

  test('a failed first-page request clears rows from the previous filter', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me(['DIAGNOSTIC_SUBMISSION_TRACK']) },
      {
        url: /\/staff\/diagnostics\/submissions\?status=ACTION_REQUIRED&limit=20$/,
        body: ok({ items: [row('action', 'NOT_PROCESSED', 'Action')], nextCursor: null, listChanged: false }),
      },
      {
        url: /\/staff\/diagnostics\/submissions\?status=PUBLISHED&limit=20$/,
        status: 500,
        body: fail('INTERNAL', 'Erreur serveur inattendue.'),
      },
    ]);
    render(<DiagnosticsQueueWorkspace basePath="/dashboard/admin/diagnostics-candidat-libre" organizationTimezone="Africa/Tunis" />);

    expect(await screen.findByText('Action Synthetic')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Publié' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Erreur serveur inattendue.');
    expect(screen.queryByText('Action Synthetic')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ouvrir la copie de Action Synthetic' })).not.toBeInTheDocument();
  });
});
