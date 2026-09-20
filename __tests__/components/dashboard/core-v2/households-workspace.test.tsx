import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HouseholdsWorkspace } from '@/components/dashboard/core-v2/HouseholdsWorkspace';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: jest.fn(), refresh: jest.fn() }) }));

type Route = { method?: string; url: RegExp; status?: number; body: unknown };

function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.url.test(url));
    if (!route) { console.error('UNMATCHED_FETCH', method, url); throw new Error(`Unexpected fetch ${method} ${url}`); }
    const status = route.status ?? 200;
    return { ok: status < 400, status, json: async () => route.body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ ok: true, data });
// Repo convention for dialog forms (see family-creation-form.test.tsx): fireEvent.change
// per field — the shared Dialog's framer-motion subtree is re-created per render under
// the jest framer-motion mock, so a multi-key userEvent.type loses its target node.
const fill = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fail = (code: string, message: string, details?: unknown) => ({ ok: false, error: { code, message, details }, correlationId: 'c-1' });
const me = ok({ actor: { userId: 'staff-1', role: 'ASSISTANTE' }, capabilities: ['HOUSEHOLD_READ', 'HOUSEHOLD_CREATE'] });

const parent = (id: string, first: string, email: string) => ({
  id, role: 'PARENT', firstName: first, lastName: 'Synthetic', email, phone: null, accountStatus: 'PENDING_ACTIVATION', activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z', isPrimaryContact: true,
});
const household = (id: string, first: string) => ({ id, createdAt: '2026-09-01T00:00:00Z', parents: [parent(`p-${id}`, first, `${first.toLowerCase()}@example.com`)], students: [] });

describe('HouseholdsWorkspace', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    push.mockClear();
  });

  test('empty state, then server search with a debounced query and cursor pagination', async () => {
    const calls = mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [], nextCursor: null }) },
      { url: /\/staff\/households\?limit=20&q=nour$/, body: ok({ items: [household('h1', 'Nour1'), household('h2', 'Nour2')], nextCursor: 'h2' }) },
      { url: /\/staff\/households\?limit=20&q=nour&cursor=h2$/, body: ok({ items: [household('h3', 'Nour3')], nextCursor: null }) },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByText(/Aucune famille enregistrée/)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Rechercher une famille/), 'nour');
    expect(await screen.findByText('Nour1 Synthetic')).toBeInTheDocument();
    expect(screen.getByText('Nour2 Synthetic')).toBeInTheDocument();
    // Go-live mission Lot 1B: identical accessible names on every row's
    // "Ouvrir la fiche" link were indistinguishable out of context (a
    // screen-reader user browsing by link list). Each link's accessible
    // name now names its own household's contact.
    expect(screen.getByRole('link', { name: 'Ouvrir la fiche de Nour1 Synthetic' })).toHaveAttribute('href', '/dashboard/assistante/familles/h1');
    expect(screen.getByRole('link', { name: 'Ouvrir la fiche de Nour2 Synthetic' })).toHaveAttribute('href', '/dashboard/assistante/familles/h2');

    await userEvent.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(await screen.findByText('Nour3 Synthetic')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Afficher plus' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes('/staff/households')).map((c) => c.url.split('?')[1])).toEqual(['limit=20', 'limit=20&q=nour', 'limit=20&q=nour&cursor=h2']);
  });

  test('API failure is announced as an alert, never rendered as an empty success', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households/, status: 503, body: fail('CORE_V2_UNAVAILABLE', 'Core v2 is not configured on this deployment.') },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Core v2 n’est pas configuré/);
    expect(screen.queryByText(/Aucune famille/)).not.toBeInTheDocument();
  });

  test('creation is gated by the duplicate check: hard conflict blocks, possible match needs explicit acknowledgement, then POST and navigate', async () => {
    const calls = mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [], nextCursor: null }) },
      { url: /\/staff\/duplicates\?.*email=taken%40example.com/, body: ok({ hardConflict: { ...parent('p-x', 'Taken', 'taken@example.com'), householdId: 'h-x' }, possibleMatches: [] }) },
      { url: /\/staff\/duplicates\?.*email=new%40example.com/, body: ok({ hardConflict: null, possibleMatches: [{ ...parent('p-y', 'Amel', 'amel@example.com'), householdId: 'h-y', reason: 'NAME' }] }) },
      { method: 'POST', url: /\/staff\/households$/, status: 201, body: ok({ household: { id: 'h-new' }, parent: parent('p-new', 'Amel', 'new@example.com'), membership: {} }) },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText(/Aucune famille enregistrée/);
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle famille' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();

    fill('Prénom', 'Amel');
    fill('Nom', 'Synthetic');
    fill('E-mail', 'taken@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier et créer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Un compte existe déjà/);
    expect(screen.getByRole('link', { name: 'Ouvrir sa fiche' })).toHaveAttribute('href', '/dashboard/assistante/familles/h-x');
    expect(screen.getByRole('button', { name: 'Créer la famille' })).toBeDisabled();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    fill('E-mail', 'new@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier et créer' }));
    expect(await screen.findByText(/Personnes proches déjà enregistrées/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Créer la famille' })).toBeDisabled();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: /créer quand même/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Créer la famille' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/assistante/familles/h-new'));
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.body).toEqual({ parent: { firstName: 'Amel', lastName: 'Synthetic', email: 'new@example.com', phone: undefined } });
  });

  test('a 409 from the API is shown in the dialog and nothing is navigated', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [], nextCursor: null }) },
      { url: /\/staff\/duplicates/, body: ok({ hardConflict: null, possibleMatches: [] }) },
      { method: 'POST', url: /\/staff\/households$/, status: 409, body: fail('CONFLICT', 'An account with this email already exists.') },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText(/Aucune famille enregistrée/);
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle famille' }));
    await screen.findByLabelText('Prénom');
    fill('Prénom', 'A');
    fill('Nom', 'B');
    fill('E-mail', 'race@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Vérifier et créer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists/);
    expect(push).not.toHaveBeenCalled();
  });

  test('account status is shown next to each named person, not as an unlabeled stack (go-live mission Lot 1B)', async () => {
    const createdAt = '2026-09-01T00:00:00Z';
    const expectedDays = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)));
    const activeStudent = {
      id: 's-1', role: 'ELEVE', firstName: 'Yanis', lastName: 'Synthetic', email: 'yanis@example.com', phone: null,
      accountStatus: 'ACTIVE', activatedAt: '2026-09-05T00:00:00Z', createdAt, updatedAt: createdAt,
    };
    const suspendedParent = { ...parent('p-h4', 'Nadia', 'nadia@example.com'), accountStatus: 'SUSPENDED' };
    mockApi([
      { url: /\/staff\/me$/, body: me },
      {
        url: /\/staff\/households\?limit=20$/,
        body: ok({
          items: [{ id: 'h4', createdAt, parents: [suspendedParent], students: [{ id: 'e-1', user: activeStudent }] }],
          nextCursor: null,
        }),
      },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText('Nadia Synthetic');

    // No separate "Comptes" column stacking unlabeled statuses.
    expect(screen.queryByText('Comptes')).not.toBeInTheDocument();

    // Each status sits right next to the person it belongs to.
    expect(screen.getByText('Suspendu')).toBeInTheDocument();
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Yanis Synthetic')).toBeInTheDocument();

    // A pending account states what it's waiting for and since when — the
    // parent fixture defaults to PENDING_ACTIVATION.
    const anotherHousehold = household('h5', 'Karim');
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [anotherHousehold], nextCursor: null }) },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText('Karim Synthetic');
    expect(screen.getByText('En attente d’activation')).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`depuis (aujourd.hui|${expectedDays} j)`))).toBeInTheDocument();
  });

  test('a household with no student shows an explicit, readable empty state', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: me },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [household('h6', 'Solo')], nextCursor: null }) },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByText('Aucun élève')).toBeInTheDocument();
  });

  test('without HOUSEHOLD_CREATE the create control is not offered', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'c', role: 'COACH' }, capabilities: [] }) },
      { url: /\/staff\/households\?limit=20$/, body: ok({ items: [], nextCursor: null }) },
    ]);
    render(<HouseholdsWorkspace basePath="/dashboard/assistante/familles" />);
    await screen.findByText(/Aucune famille enregistrée/);
    expect(screen.queryByRole('button', { name: 'Nouvelle famille' })).not.toBeInTheDocument();
  });
});
