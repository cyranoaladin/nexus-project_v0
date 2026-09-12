import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AcademicYearsPanel } from '@/components/dashboard/core-v2/AcademicYearsPanel';

type Route = { method?: string; url: RegExp; status?: number; body: unknown | (() => unknown) };

function mockApi(routes: Route[]) {
  const calls: Array<{ method: string; url: string; body: unknown }> = [];
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
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
const year = (id: string, startYear: number, status: string) => ({ id, startYear, startsAt: `${startYear}-09-01T00:00:00.000Z`, endsAt: `${startYear + 1}-07-15T00:00:00.000Z`, status });

describe('AcademicYearsPanel', () => {
  afterEach(() => jest.restoreAllMocks());

  test('lists years with their status; promotes an UPCOMING year and closes the CURRENT one, refreshing after each 2xx', async () => {
    let state = [year('y1', 2025, 'CURRENT'), year('y2', 2026, 'UPCOMING')];
    const calls = mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ADMIN' }, capabilities: ['HOUSEHOLD_READ', 'ENROLLMENT_CREATE'] }) },
      { url: /\/staff\/academic-years$/, body: () => ok(state) },
      { method: 'POST', url: /\/academic-years\/y2\/current$/, body: () => { state = [year('y1', 2025, 'CLOSED'), year('y2', 2026, 'CURRENT')]; return ok(state[1]); } },
      { method: 'POST', url: /\/academic-years\/y2\/close$/, body: () => { state = [year('y1', 2025, 'CLOSED'), year('y2', 2026, 'CLOSED')]; return ok(state[1]); } },
    ]);
    render(<AcademicYearsPanel />);
    expect(await screen.findByText('2025-2026')).toBeInTheDocument();
    expect(screen.getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('À venir')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Passer en cours' }));
    expect(await screen.findByRole('status')).toHaveTextContent('2026-2027 est maintenant l’année en cours.');
    await waitFor(() => expect(screen.getAllByText('Clôturée')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Passer en cours' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clôturer' }));
    await waitFor(() => expect(screen.getAllByText('Clôturée')).toHaveLength(2));
    expect(calls.filter((c) => c.method === 'GET' && /academic-years$/.test(c.url)).length).toBe(3);
  });

  test('creating a year sends configured dates (never a built-in calendar) and shows the API validation error as an alert', async () => {
    const calls = mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'a', role: 'ASSISTANTE' }, capabilities: ['ENROLLMENT_CREATE'] }) },
      { url: /\/staff\/academic-years$/, body: ok([]) },
      { method: 'POST', url: /\/staff\/academic-years$/, status: 400, body: { ok: false, error: { code: 'VALIDATION', message: 'endsAt must be after startsAt.', details: { field: 'endsAt' } }, correlationId: 'c' } },
    ]);
    render(<AcademicYearsPanel />);
    await screen.findByText(/Aucune année scolaire/);
    fireEvent.change(screen.getByLabelText('Année de début'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('Début'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Fin'), { target: { value: '2026-08-01' } });
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('endsAt must be after startsAt.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ startYear: 2026, startsAt: '2026-09-01', endsAt: '2026-08-01' });
  });

  test('without ENROLLMENT_CREATE the panel is read-only', async () => {
    mockApi([
      { url: /\/staff\/me$/, body: ok({ actor: { userId: 'c', role: 'COACH' }, capabilities: [] }) },
      { url: /\/staff\/academic-years$/, body: ok([year('y1', 2026, 'CURRENT')]) },
    ]);
    render(<AcademicYearsPanel />);
    expect(await screen.findByText('2026-2027')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clôturer' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Année de début')).not.toBeInTheDocument();
  });
});
