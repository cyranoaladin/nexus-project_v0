import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { HouseholdDetail } from '@/components/dashboard/core-v2/HouseholdDetail';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }) }));

type Route = { method?: string; url: RegExp; status?: number; body: unknown | (() => unknown) };

function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.url.test(url));
    if (!route) { console.error('UNMATCHED_FETCH', method, url); throw new Error(`Unexpected fetch ${method} ${url}`); }
    const status = route.status ?? 200;
    const body = typeof route.body === 'function' ? (route.body as () => unknown)() : route.body;
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ ok: true, data });
const fail = (code: string, message: string) => ({ ok: false, error: { code, message }, correlationId: 'c-2' });
const user = (id: string, role: string, first: string, accountStatus = 'PENDING_ACTIVATION') => ({
  id, role, firstName: first, lastName: 'Synthetic', email: `${first.toLowerCase()}@example.com`, phone: null, accountStatus, activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
});

function detailFixture(overrides: { enrollmentStatus?: 'PENDING' | 'ACTIVE'; seriesRevision?: number } = {}) {
  return {
    id: 'h1',
    createdAt: '2026-09-01T00:00:00Z',
    parents: [{ ...user('p1', 'PARENT', 'Amel', 'ACTIVE'), isPrimaryContact: true }],
    students: [
      {
        id: 's1',
        birthDate: null,
        user: user('u-s1', 'ELEVE', 'Yasmine'),
        enrollments: [
          {
            id: 'e1',
            status: overrides.enrollmentStatus ?? 'PENDING',
            academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' },
            gradeLevel: 'PREMIERE',
            academicTrack: 'EDS_GENERALE',
            stmgPathway: null,
            schoolingStatus: null,
            school: null,
            academicRevision: 0,
            approvedAt: null,
            courses: [{ id: 'c1', courseKey: 'maths-premiere', kind: 'SPECIALTY' }],
            assignments: [
              {
                id: 'a1',
                courseKey: 'maths-premiere',
                status: 'ACTIVE',
                startsAt: '2026-09-10T00:00:00Z',
                endsAt: null,
                coach: { id: 'coach-1', user: { id: 'u-c1', firstName: 'Coach', lastName: 'Un' } },
                planningSeries: [{ id: 'ps1', status: 'ACTIVE', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', localStartTime: '18:00', localEndTime: '19:00', timezone: 'Europe/Paris', revision: overrides.seriesRevision ?? 0 }],
              },
            ],
          },
        ],
      },
    ],
  };
}

const years = ok([{ id: 'y1', startYear: 2026, startsAt: '2026-09-01T00:00:00Z', endsAt: '2027-07-15T00:00:00Z', status: 'CURRENT' }]);
const coaches = ok({ items: [{ id: 'coach-1', user: user('u-c1', 'COACH', 'Coach', 'ACTIVE'), capabilities: ['maths-premiere'] }], nextCursor: null });
const ADMIN_CAPS = ['HOUSEHOLD_READ', 'HOUSEHOLD_CREATE', 'HOUSEHOLD_EDIT', 'PARENT_CREATE', 'PARENT_ATTACH', 'STUDENT_CREATE', 'STUDENT_EDIT', 'ENROLLMENT_CREATE', 'ENROLLMENT_APPROVE', 'ENROLLMENT_WITHDRAW', 'COURSE_MANAGE', 'COACH_CAPABILITY_MANAGE', 'COACH_ASSIGN', 'PLANNING_MANAGE', 'ACCOUNT_INVITE', 'ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'AUDIT_READ'];
const ASSISTANTE_CAPS = ADMIN_CAPS.filter((c) => !['ACCOUNT_SUSPEND', 'ACCOUNT_REACTIVATE', 'AUDIT_READ'].includes(c));

describe('HouseholdDetail', () => {
  afterEach(() => jest.restoreAllMocks());

  test('renders parents, students, enrollment, courses, coach and planning from the read model', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS }) },
      { url: /\/staff\/households\/h1$/, body: ok(detailFixture()) },
      { url: /\/staff\/academic-years$/, body: years },
      { url: /\/staff\/coaches/, body: coaches },
    ]);
    render(<HouseholdDetail householdId="h1" basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByRole('heading', { name: /Foyer Amel Synthetic/ })).toBeInTheDocument();
    expect(screen.getByText('Yasmine Synthetic')).toBeInTheDocument();
    const enrollment = screen.getByRole('article', { name: 'Inscription 2026-2027' });
    expect(within(enrollment).getByText(/En attente/)).toBeInTheDocument();
    expect(within(enrollment).getByText('maths-premiere')).toBeInTheDocument();
    expect(within(enrollment).getByText(/Coach Un/)).toBeInTheDocument();
    expect(within(enrollment).getByText(/FREQ=WEEKLY;BYDAY=TU · 18:00–19:00 \(Europe\/Paris\)/)).toBeInTheDocument();
  });

  test('ADMIN-only account actions are hidden for ASSISTANTE and shown for ADMIN', async () => {
    const routes: Route[] = [
      { url: /\/staff\/households\/h1$/, body: ok(detailFixture()) },
      { url: /\/staff\/academic-years$/, body: years },
      { url: /\/staff\/coaches/, body: coaches },
    ];
    mockApi([{ url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS }) }, ...routes]);
    const { unmount } = render(<HouseholdDetail householdId="h1" basePath="/x" />);
    await screen.findByRole('heading', { name: /Foyer/ });
    expect(screen.queryByRole('button', { name: 'Suspendre' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Inviter' }).length).toBeGreaterThan(0);
    unmount();

    mockApi([{ url: /\/staff\/me$/, body: ok({ actor: { userId: 'b', role: 'ADMIN' }, capabilities: ADMIN_CAPS }) }, ...routes]);
    render(<HouseholdDetail householdId="h1" basePath="/x" />);
    await screen.findByRole('heading', { name: /Foyer/ });
    expect(screen.getByRole('button', { name: 'Suspendre' })).toBeInTheDocument();
  });

  test('approving refreshes the fiche and announces success only after a 2xx; a stale 409 is announced as an alert', async () => {
    let approved = false;
    const calls = mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS }) },
      { url: /\/staff\/households\/h1$/, body: () => ok(detailFixture({ enrollmentStatus: approved ? 'ACTIVE' : 'PENDING' })) },
      { url: /\/staff\/academic-years$/, body: years },
      { url: /\/staff\/coaches/, body: coaches },
      { method: 'POST', url: /\/staff\/enrollments\/e1\/approve$/, body: () => { approved = true; return ok({ id: 'e1', status: 'ACTIVE' }); } },
      { method: 'PATCH', url: /\/staff\/planning\/series\/ps1$/, status: 409, body: fail('CONFLICT', 'The planning series was modified by someone else; reload and retry.') },
    ]);
    render(<HouseholdDetail householdId="h1" basePath="/x" />);
    const enrollment = await screen.findByRole('article', { name: 'Inscription 2026-2027' });
    await userEvent.click(within(enrollment).getByRole('button', { name: 'Approuver' }));
    expect(await within(enrollment).findByRole('status')).toHaveTextContent('Inscription approuvée.');
    await waitFor(() => expect(within(enrollment).getByText(/Active/)).toBeInTheDocument());
    expect(within(enrollment).queryByRole('button', { name: 'Approuver' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && /households\/h1$/.test(c.url)).length).toBe(2);

    await userEvent.click(within(enrollment).getByRole('button', { name: 'Terminer la série' }));
    const alert = await within(enrollment).findByRole('alert');
    expect(alert).toHaveTextContent(/modified by someone else/);
    expect(alert).toHaveTextContent(/rechargé/);
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch?.body).toEqual({ expectedRevision: 0, changes: { status: 'ENDED' } });
  });

  test('invitation success comes only from a 201 and the button is disabled while pending', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const calls = mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS }) },
      { url: /\/staff\/households\/h1$/, body: ok(detailFixture()) },
      { url: /\/staff\/academic-years$/, body: years },
      { url: /\/staff\/coaches/, body: coaches },
    ]);
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if ((init?.method ?? 'GET') === 'POST' && /accounts\/u-s1\/invite$/.test(url)) {
        calls.push({ method: 'POST', url, body: undefined });
        await gate;
        return { ok: true, status: 201, json: async () => ok({ user: user('u-s1', 'ELEVE', 'Yasmine'), invitation: { id: 'inv', expiresAt: '2026-09-20T00:00:00Z' } }) } as unknown as Response;
      }
      return original(input, init);
    }) as typeof fetch;

    render(<HouseholdDetail householdId="h1" basePath="/x" />);
    const student = await screen.findByRole('region', { name: 'Yasmine Synthetic' });
    await userEvent.click(within(student).getByRole('button', { name: 'Inviter' }));
    await waitFor(() => expect(within(student).getByRole('button', { name: 'Inviter' })).toBeDisabled());
    expect(within(student).queryByText('Invitation envoyée.')).not.toBeInTheDocument();
    release();
    expect(await within(student).findByText('Invitation envoyée.')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST').length).toBe(1);
  });

  test('a 404 fiche shows an error and a way back, never a blank page', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ASSISTANTE_CAPS }) },
      { url: /\/staff\/households\/missing$/, status: 404, body: fail('NOT_FOUND', 'Household not found.') },
      { url: /\/staff\/academic-years$/, body: years },
      { url: /\/staff\/coaches/, body: coaches },
    ]);
    render(<HouseholdDetail householdId="missing" basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Household not found.');
    expect(screen.getByRole('link', { name: 'Retour aux familles' })).toHaveAttribute('href', '/dashboard/assistante/familles');
  });
});
