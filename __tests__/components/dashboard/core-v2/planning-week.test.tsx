import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { PlanningWeek } from '@/components/dashboard/core-v2/PlanningWeek';

const router = { push: jest.fn(), replace: jest.fn(), refresh: jest.fn() };
let search = new URLSearchParams('semaine=2026-09-14');
jest.mock('next/navigation', () => ({ useRouter: () => router, useSearchParams: () => search }));

type Route = { method?: string; url: RegExp; status?: number; body: unknown | (() => unknown) };
function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();
    calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const route = routes.find((r) => (r.method ?? 'GET') === method && r.url.test(url));
    if (!route) throw new Error(`Unexpected fetch ${method} ${url}`);
    const status = route.status ?? 200;
    const body = typeof route.body === 'function' ? (route.body as () => unknown)() : route.body;
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
  return calls;
}

const ok = (data: unknown) => ({ ok: true, data });
const staff = ok({ actor: { userId: 'a1', role: 'ASSISTANTE' }, capabilities: ['HOUSEHOLD_READ', 'PLANNING_MANAGE'] });
const readOnly = ok({ actor: { userId: 'c1', role: 'ADMIN' }, capabilities: ['HOUSEHOLD_READ'] });

const booking = (id: string, status: string, startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) => ({
  id, status, startsAt, endsAt, modality: 'ONLINE', location: null, occurrenceKey: null, overridesBookingId: null, cancelledAt: null, completedAt: null,
  courseKey: 'maths-premiere', assignment: { id: 'a1', courseKey: 'maths-premiere', status: 'ACTIVE' },
  coach: { id: 'c1', user: { id: 'u-c1', firstName: 'Coach', lastName: 'Synthetic' } },
  student: { id: 's1', user: { id: 'u-s1', firstName: 'Yasmine', lastName: 'Synthetic' } },
  series: { id: 'ps1', timezone: 'Africa/Tunis', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', revision: 2, status: 'ACTIVE' },
  ...extra,
});

describe('PlanningWeek (staff)', () => {
  beforeEach(() => {
    router.push.mockClear();
    search = new URLSearchParams('semaine=2026-09-14');
  });

  it('lists the week’s occurrences by day in the planning zone, including a row on the last day and one out of range', async () => {
    let bookings = [
      booking('b1', 'SCHEDULED', '2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z'),
      booking('b2', 'CANCELLED', '2026-09-17T09:00:00Z', '2026-09-17T10:00:00Z'),
      // 23:30Z Sunday 20th = 00:30 Monday 21st in Tunis → next week, filtered out.
      booking('b3', 'SCHEDULED', '2026-09-20T23:30:00Z', '2026-09-21T00:30:00Z'),
    ];
    const calls = mockApi([
      { url: /\/api\/v2\/staff\/me$/, body: staff },
      { url: /\/staff\/planning\/bookings\?/, body: () => ok(bookings) },
      { method: 'POST', url: /\/bookings\/b1\/cancel$/, body: () => { bookings = bookings.map((b) => (b.id === 'b1' ? { ...b, status: 'CANCELLED' } : b)); return ok({ id: 'b1', status: 'CANCELLED' }); } },
    ]);
    render(<PlanningWeek basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByText(/Semaine du 14 septembre 2026/)).toBeInTheDocument();
    const tuesday = await screen.findByRole('region', { name: '15 septembre 2026' });
    expect(within(tuesday).getByText(/18h00–19h00 · Yasmine Synthetic — maths-premiere/)).toBeInTheDocument();
    expect(within(tuesday).getByText(/Planifiée/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '17 septembre 2026' })).toHaveTextContent('Annulée');
    expect(screen.queryByRole('region', { name: '21 septembre 2026' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '20 septembre 2026' })).not.toBeInTheDocument();
    const range = new URL(calls.find((c) => c.url.includes('/staff/planning/bookings?'))!.url, 'http://localhost');
    expect(range.searchParams.get('from')).toBe('2026-09-13T00:00:00.000Z');
    expect(range.searchParams.get('to')).toBe('2026-09-22T00:00:00.000Z');

    // Cancel one occurrence through the dialog: reason required, then reload shows it cancelled.
    await userEvent.click(within(tuesday).getByRole('button', { name: 'Annuler la séance' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Confirmer l’annulation' })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Coach indisponible' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirmer l’annulation' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/bookings/b1/cancel'))).toBe(true));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ reason: 'Coach indisponible' });
    await waitFor(() => expect(screen.getByRole('region', { name: '15 septembre 2026' })).toHaveTextContent('Annulée'));
    expect(within(screen.getByRole('region', { name: '15 septembre 2026' })).queryByRole('button', { name: 'Annuler la séance' })).not.toBeInTheDocument();
  });

  it('reschedules through the dialog (series zone), cancels the series with the revision it read, and surfaces a 409', async () => {
    const calls = mockApi([
      { url: /\/api\/v2\/staff\/me$/, body: staff },
      { url: /\/staff\/planning\/bookings\?/, body: ok([booking('b1', 'SCHEDULED', '2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z')]) },
      { method: 'POST', url: /\/bookings\/b1\/reschedule$/, status: 409, body: { ok: false, error: { code: 'CONFLICT', message: 'One or more occurrences collide with an existing booking.' } } },
      { method: 'POST', url: /\/series\/ps1\/cancel$/, body: ok({ id: 'ps1', status: 'CANCELLED' }) },
    ]);
    render(<PlanningWeek basePath="/dashboard/assistante/familles" />);
    const row = await screen.findByRole('listitem', { name: /18h00–19h00 Yasmine Synthetic — maths-premiere/ });

    await userEvent.click(within(row).getByRole('button', { name: 'Déplacer' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Date')).toHaveValue('2026-09-15');
    fireEvent.change(within(dialog).getByLabelText('Début'), { target: { value: '10:00' } });
    fireEvent.change(within(dialog).getByLabelText('Fin'), { target: { value: '11:00' } });
    fireEvent.change(within(dialog).getByLabelText('Motif'), { target: { value: 'Rattrapage' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Déplacer' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('collide');
    const move = calls.find((c) => c.method === 'POST' && c.url.endsWith('/reschedule'))!;
    expect(move.body).toEqual({ localDate: '2026-09-15', localStartTime: '10:00', localEndTime: '11:00', reason: 'Rattrapage' });
    await userEvent.keyboard('{Escape}');

    await userEvent.click(within(row).getByRole('button', { name: 'Annuler la série' }));
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/series/ps1/cancel'))).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/series/ps1/cancel'))!.body).toEqual({ expectedRevision: 2 });
  });

  it('navigates weeks through the URL and hides every mutation without PLANNING_MANAGE', async () => {
    mockApi([
      { url: /\/api\/v2\/staff\/me$/, body: readOnly },
      { url: /\/staff\/planning\/bookings\?/, body: ok([booking('b1', 'SCHEDULED', '2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z')]) },
    ]);
    render(<PlanningWeek basePath="/dashboard/admin/familles" />);
    await screen.findByRole('listitem', { name: /Yasmine Synthetic/ });
    expect(screen.queryByRole('button', { name: 'Annuler la séance' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Déplacer' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler la série' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    expect(router.push).toHaveBeenCalledWith('/dashboard/admin/familles/planning?semaine=2026-09-21');
    await userEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    expect(router.push).toHaveBeenCalledWith('/dashboard/admin/familles/planning?semaine=2026-09-07');
  });

  it('shows the empty state for a week without sessions', async () => {
    mockApi([
      { url: /\/api\/v2\/staff\/me$/, body: staff },
      { url: /\/staff\/planning\/bookings\?/, body: ok([]) },
    ]);
    render(<PlanningWeek basePath="/dashboard/assistante/familles" />);
    expect(await screen.findByText('Aucune séance planifiée cette semaine.')).toBeInTheDocument();
  });
});
