import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { CoachCapabilitiesPanel } from '@/components/dashboard/core-v2/CoachCapabilitiesPanel';

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
const user = (id: string, first: string) => ({
  id, role: 'COACH', firstName: first, lastName: 'Synthetic', email: `${first.toLowerCase()}@example.com`, phone: null,
  accountStatus: 'ACTIVE', activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
});

const canManage = () => true;
const readOnly = () => false;

describe('CoachCapabilitiesPanel', () => {
  afterEach(() => jest.restoreAllMocks());

  test('shows the effective capabilities read from the server', async () => {
    mockApi([{ url: /\/staff\/coaches/, body: ok({ items: [{ id: 'c1', user: user('u1', 'Nadia'), capabilities: ['maths-premiere'] }], nextCursor: null }) }]);
    render(<CoachCapabilitiesPanel can={canManage} />);
    expect(await screen.findByText('Nadia Synthetic')).toBeInTheDocument();
    expect(screen.getByText('maths-premiere')).toBeInTheDocument();
  });

  test('an actor without COACH_CAPABILITY_MANAGE sees the capabilities but no active form — read-only, not blank', async () => {
    mockApi([{ url: /\/staff\/coaches/, body: ok({ items: [{ id: 'c1', user: user('u1', 'Nadia'), capabilities: ['maths-premiere'] }], nextCursor: null }) }]);
    render(<CoachCapabilitiesPanel can={readOnly} />);
    expect(await screen.findByText('maths-premiere')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajouter/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retirer/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Lecture seule/)).toBeInTheDocument();
  });

  test('granting a capability persists through the existing route and the new value survives a reload', async () => {
    let granted = false;
    const calls = mockApi([
      {
        url: /\/staff\/coaches\?/,
        body: () => ok({ items: [{ id: 'c1', user: user('u1', 'Nadia'), capabilities: granted ? ['anglais-premiere'] : [] }], nextCursor: null }),
      },
      {
        method: 'PUT',
        url: /\/staff\/coaches\/c1\/capabilities$/,
        body: () => {
          granted = true;
          return ok({ capability: { id: 'cap1', coachId: 'c1', courseKey: 'anglais-premiere' } });
        },
      },
    ]);
    render(<CoachCapabilitiesPanel can={canManage} />);
    await screen.findByText('Nadia Synthetic');
    expect(screen.getByText('Aucune habilitation.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Ajouter une habilitation'), 'anglais-premiere');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByText('anglais-premiere')).toBeInTheDocument();
    expect(screen.queryByText('Aucune habilitation.')).not.toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.body).toEqual({ courseKey: 'anglais-premiere', granted: true });
    // The displayed value came from a fresh server read, not a client-side splice.
    expect(calls.filter((c) => c.method === 'GET').length).toBe(2);
  });

  test('revoking a capability that is refused server-side (ACTIVE assignments still use it) shows the refusal and keeps the capability', async () => {
    const calls = mockApi([
      { url: /\/staff\/coaches\?/, body: ok({ items: [{ id: 'c1', user: user('u1', 'Nadia'), capabilities: ['maths-premiere'] }], nextCursor: null }) },
      {
        method: 'PUT',
        url: /\/staff\/coaches\/c1\/capabilities$/,
        status: 409,
        body: fail('INVALID_STATE', 'Cannot revoke a capability while ACTIVE assignments use it.'),
      },
    ]);
    render(<CoachCapabilitiesPanel can={canManage} />);
    await screen.findByText('maths-premiere');
    await userEvent.click(screen.getByRole('button', { name: /Retirer l’habilitation maths-premiere/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ACTIVE assignments/);
    expect(screen.getByText('maths-premiere')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT' && c.body === undefined)).toBe(false);
  });

  test('a server-side validation refusal on grant is shown without silently accepting the value', async () => {
    mockApi([
      { url: /\/staff\/coaches\?/, body: ok({ items: [{ id: 'c1', user: user('u1', 'Nadia'), capabilities: [] }], nextCursor: null }) },
      { method: 'PUT', url: /\/staff\/coaches\/c1\/capabilities$/, status: 400, body: fail('VALIDATION', 'Invalid input.') },
    ]);
    render(<CoachCapabilitiesPanel can={canManage} />);
    await screen.findByText('Nadia Synthetic');
    await userEvent.type(screen.getByLabelText('Ajouter une habilitation'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Ajouter une habilitation')).toHaveValue('x'));
  });
});
