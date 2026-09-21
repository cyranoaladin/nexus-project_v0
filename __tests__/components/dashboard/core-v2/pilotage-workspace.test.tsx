import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PilotageWorkspace } from '@/components/dashboard/core-v2/PilotageWorkspace';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }) }));

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
const fail = (code: string, message: string) => ({ ok: false, error: { code, message }, correlationId: 'c-1' });
const user = (id: string, role: string, first: string) => ({
  id, role, firstName: first, lastName: 'Synthetic', email: `${first.toLowerCase()}@example.com`, phone: null,
  accountStatus: 'ACTIVE', activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
});

const ASSISTANTE_CAPS = ['HOUSEHOLD_READ', 'ENROLLMENT_APPROVE', 'COACH_ASSIGN', 'COACH_CAPABILITY_MANAGE'];
const me = ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS });
const currentYear = { id: 'y1', startYear: 2026, startsAt: '2026-09-01T00:00:00Z', endsAt: '2027-07-15T00:00:00Z', status: 'CURRENT' };
const noCoaches = ok({ items: [], nextCursor: null });

const pendingItem = {
  id: 'enr-1',
  createdAt: '2026-09-01T00:00:00Z',
  gradeLevel: 'PREMIERE',
  academicTrack: 'EDS_GENERALE',
  academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' },
  student: { id: 's1', user: user('u-s1', 'ELEVE', 'Yasmine') },
  household: { id: 'h1', primaryContactName: 'Amel Synthetic' },
};

const unassignedItem = {
  id: 'sce-1',
  courseKey: 'maths-premiere',
  kind: 'SPECIALTY',
  createdAt: '2026-09-02T00:00:00Z',
  enrollment: { id: 'enr-2', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' } },
  student: { id: 's2', user: user('u-s2', 'ELEVE', 'Karim') },
  household: { id: 'h2', primaryContactName: 'Nadia Synthetic' },
};

describe('PilotageWorkspace', () => {
  afterEach(() => jest.restoreAllMocks());

  test('renders both indicators with their counter, their rows, and a deep link into the right household + enrollment', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([currentYear]) },
      { url: /\/staff\/enrollments\/pending/, body: ok({ items: [pendingItem], nextCursor: null, totalCount: 1 }) },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [unassignedItem], nextCursor: null, totalCount: 1 }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);

    await screen.findByText('Yasmine Synthetic');
    await waitFor(() => expect(screen.getByRole('heading', { name: /Inscriptions à valider/ })).toHaveTextContent('(1)'));
    expect(screen.getByText('Amel Synthetic')).toBeInTheDocument();

    await screen.findByText('Karim Synthetic');
    await waitFor(() => expect(screen.getByRole('heading', { name: /Inscriptions à un cours sans enseignant affecté/ })).toHaveTextContent('(1)'));
    expect(screen.getByText('maths-premiere')).toBeInTheDocument();

    const links = screen.getAllByRole('link', { name: 'Ouvrir le dossier' });
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/dashboard/assistante/familles/h1#core-v2-enrollment-enr-1',
      '/dashboard/assistante/familles/h2#core-v2-enrollment-enr-2',
    ]);
  });

  test('with no CURRENT academic year, shows an explicit configuration state — never a zero counter that would look like everything is treated', async () => {
    const calls = mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([{ ...currentYear, status: 'UPCOMING' }]) },
      { url: /\/staff\/enrollments\/pending/, body: ok({ items: [], nextCursor: null, totalCount: 0 }) },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [], nextCursor: null, totalCount: 0 }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);

    expect(await screen.findByText(/Année scolaire courante à configurer/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Inscriptions à valider/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Inscriptions à un cours sans enseignant affecté/ })).not.toBeInTheDocument();
    expect(calls.some((c) => /\/staff\/enrollments\/pending/.test(c.url))).toBe(false);
    expect(calls.some((c) => /\/staff\/assignments\/needed/.test(c.url))).toBe(false);
  });

  test('a CURRENT year with zero pending enrollments shows an explicit empty state, distinct from the no-year state', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([currentYear]) },
      { url: /\/staff\/enrollments\/pending/, body: ok({ items: [], nextCursor: null, totalCount: 0 }) },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [], nextCursor: null, totalCount: 0 }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);

    expect(await screen.findByText('Aucune inscription en attente pour l’instant.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('heading', { name: /Inscriptions à valider/ })).toHaveTextContent('(0)'));
    expect(screen.getByText('Aucun cours sans affectation active pour l’instant.')).toBeInTheDocument();
  });

  test('an indicator API failure is shown as a recoverable error, never presented as a zero count', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([currentYear]) },
      { url: /\/staff\/enrollments\/pending/, status: 503, body: fail('SERVICE_UNAVAILABLE', 'Le référentiel Core v2 est indisponible.') },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [unassignedItem], nextCursor: null, totalCount: 1 }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/indisponible/);
    expect(screen.getByRole('heading', { name: /Inscriptions à valider/ })).not.toHaveTextContent(/\(\d+\)/);
  });

  test('pagination appends rows through the cursor without truncating the already-loaded ones, pinning the academic year the first page resolved', async () => {
    const secondItem = { ...pendingItem, id: 'enr-3', student: { id: 's3', user: user('u-s3', 'ELEVE', 'Zied') }, household: { id: 'h3', primaryContactName: null } };
    const calls = mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([currentYear]) },
      {
        url: /\/staff\/enrollments\/pending/,
        body: () => ok({ items: [pendingItem], nextCursor: 'enr-1', totalCount: 2, academicYearId: 'y1', listChanged: false }),
      },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [], nextCursor: null, totalCount: 0, academicYearId: 'y1', listChanged: false }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    // Override the pending route to branch on the cursor param (mockApi's simple
    // regex routing can't do that), mirroring the pattern other Core v2 tests use.
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = (init?.method ?? 'GET').toUpperCase();
      if (/\/staff\/enrollments\/pending/.test(url) && /cursor=enr-1/.test(url)) {
        calls.push({ method, url, body: undefined });
        return { ok: true, status: 200, json: async () => ok({ items: [secondItem], nextCursor: null, totalCount: 2, academicYearId: 'y1', listChanged: false }) } as unknown as Response;
      }
      return original(input, init);
    }) as typeof fetch;

    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText('Yasmine Synthetic');
    await waitFor(() => expect(screen.getByRole('heading', { name: /Inscriptions à valider/ })).toHaveTextContent('(2)'));
    expect(screen.queryByText('Zied Synthetic')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(await screen.findByText('Zied Synthetic')).toBeInTheDocument();
    expect(screen.getByText('Yasmine Synthetic')).toBeInTheDocument();
    const loadMoreCall = calls.find((c) => /cursor=enr-1/.test(c.url));
    expect(loadMoreCall?.url).toMatch(/academicYearId=y1/);
  });

  test('a listChanged response replaces the already-loaded list instead of appending to it', async () => {
    const staleFollowUp = { ...pendingItem, id: 'enr-9', student: { id: 's9', user: user('u-s9', 'ELEVE', 'Nouveau') }, household: { id: 'h9', primaryContactName: null } };
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/academic-years$/, body: ok([currentYear]) },
      {
        url: /\/staff\/enrollments\/pending/,
        body: () => ok({ items: [pendingItem], nextCursor: 'enr-1', totalCount: 2, academicYearId: 'y1', listChanged: false }),
      },
      { url: /\/staff\/assignments\/needed/, body: ok({ items: [], nextCursor: null, totalCount: 0, academicYearId: 'y1', listChanged: false }) },
      { url: /\/staff\/coaches/, body: noCoaches },
    ]);
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (/\/staff\/enrollments\/pending/.test(url) && /cursor=enr-1/.test(url)) {
        // The row the cursor pointed at was processed elsewhere between the two page loads.
        return { ok: true, status: 200, json: async () => ok({ items: [staleFollowUp], nextCursor: null, totalCount: 1, academicYearId: 'y1', listChanged: true }) } as unknown as Response;
      }
      return original(input, init);
    }) as typeof fetch;

    render(<PilotageWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText('Yasmine Synthetic');
    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));

    expect(await screen.findByText('Nouveau Synthetic')).toBeInTheDocument();
    // Replaced, not appended: the first page's row is gone from the DOM, not duplicated alongside the new one.
    expect(screen.queryByText('Yasmine Synthetic')).not.toBeInTheDocument();
    expect(await screen.findByText(/La liste a changé/)).toBeInTheDocument();
  });
});
