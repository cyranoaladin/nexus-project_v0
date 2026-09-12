import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { UPCOMING_WINDOW_DAYS, UpcomingSessions } from '@/components/dashboard/core-v2/UpcomingSessions';

const calls: string[] = [];
function mockApi(status: number, body: unknown) {
  calls.length = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

const booking = (id: string, status: string, startsAt: string, endsAt: string, extra: Record<string, unknown> = {}) => ({
  id, status, startsAt, endsAt, modality: 'ONLINE', location: null, occurrenceKey: `s1:r0:${startsAt.slice(0, 10)}`, overridesBookingId: null, cancelledAt: null, completedAt: null,
  courseKey: 'maths-premiere', assignment: { id: 'a1', courseKey: 'maths-premiere', status: 'ACTIVE' },
  coach: { id: 'c1', user: { id: 'u-c1', firstName: 'Coach', lastName: 'Synthetic' } },
  student: { id: 's1', user: { id: 'u-s1', firstName: 'Yasmine', lastName: 'Synthetic' } },
  series: { id: 'ps1', timezone: 'Africa/Tunis', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', revision: 0, status: 'ACTIVE' },
  ...extra,
});

describe('UpcomingSessions', () => {
  const now = () => new Date('2026-09-10T12:00:00Z');

  it('asks the role endpoint for the next window and lists live sessions in the planning zone, other party by name', async () => {
    mockApi(200, {
      ok: true,
      data: [
        booking('b1', 'SCHEDULED', '2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z'),
        booking('b2', 'CANCELLED', '2026-09-22T17:00:00Z', '2026-09-22T18:00:00Z'),
        booking('b3', 'SCHEDULED', '2026-09-24T08:00:00Z', '2026-09-24T09:00:00Z', { overridesBookingId: 'b9' }),
      ],
    });
    render(<UpcomingSessions scope="parent" now={now} />);
    expect(await screen.findByText(/mardi 15 septembre 2026 · 18h00–19h00/)).toBeInTheDocument();
    expect(screen.getByText(/jeudi 24 septembre 2026 · 09h00–10h00/)).toBeInTheDocument();
    expect(screen.getByText(/séance déplacée/)).toBeInTheDocument();
    expect(screen.getAllByText(/Coach Coach Synthetic/)).toHaveLength(2);
    expect(screen.queryByText(/22 septembre/)).not.toBeInTheDocument(); // cancelled rows are not "upcoming"
    const url = new URL(calls[0]!, 'http://localhost');
    expect(url.pathname).toBe('/api/v2/parent/planning');
    expect(url.searchParams.get('from')).toBe('2026-09-10T12:00:00.000Z');
    expect(new Date(url.searchParams.get('to')!).getTime() - now().getTime()).toBe(UPCOMING_WINDOW_DAYS * 86_400_000);
  });

  it('a coach sees the student by name; empty window and failures are explicit', async () => {
    mockApi(200, { ok: true, data: [booking('b1', 'CONFIRMED', '2026-09-15T17:00:00Z', '2026-09-15T18:00:00Z')] });
    render(<UpcomingSessions scope="coach" now={now} />);
    expect(await screen.findByText(/Élève Yasmine Synthetic/)).toBeInTheDocument();
    expect(calls[0]).toContain('/api/v2/coach/planning?');

    mockApi(200, { ok: true, data: [] });
    render(<UpcomingSessions scope="student" now={now} />);
    expect(await screen.findByText(`Aucune séance planifiée dans les ${UPCOMING_WINDOW_DAYS} prochains jours.`)).toBeInTheDocument();

    mockApi(503, { ok: false, error: { code: 'CORE_V2_UNAVAILABLE', message: 'x' } });
    render(<UpcomingSessions scope="student" now={now} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Le référentiel Core v2 n’est pas configuré sur ce déploiement.');
  });
});
