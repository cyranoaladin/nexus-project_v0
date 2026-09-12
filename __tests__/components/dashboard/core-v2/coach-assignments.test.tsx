import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { CoachAssignments } from '@/components/dashboard/core-v2/CoachAssignments';

// The main read model is mocked with the given status/body; the embedded
// "Prochaines séances" list (self-service /planning range) answers empty.
function mockApi(status: number, body: unknown) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/planning?')) return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as unknown as Response;
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

const coach = {
  id: 'c1',
  user: { id: 'u-c1', role: 'COACH', firstName: 'Coach', lastName: 'Synthetic', email: null, phone: null, accountStatus: 'ACTIVE', activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  capabilities: ['maths-premiere', 'maths-terminale'],
  assignments: [
    {
      id: 'a1', courseKey: 'maths-premiere', status: 'ACTIVE', startsAt: '2026-09-02T00:00:00Z', endsAt: null,
      enrollment: { id: 'e1', status: 'ACTIVE', gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' } },
      student: { id: 's1', user: { id: 'u1', firstName: 'Yasmine', lastName: 'Synthetic' } },
      planningSeries: [{ id: 'ps1', status: 'ACTIVE', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', localStartTime: '18:00', localEndTime: '19:00', timezone: 'Africa/Tunis', revision: 1 }],
    },
    {
      id: 'a2', courseKey: 'maths-terminale', status: 'ENDED', startsAt: '2026-09-02T00:00:00Z', endsAt: '2026-09-03T00:00:00Z',
      enrollment: { id: 'e2', status: 'ACTIVE', gradeLevel: 'TERMINALE', academicTrack: 'EDS_GENERALE', academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' } },
      student: { id: 's2', user: { id: 'u2', firstName: 'Ancien', lastName: 'Élève' } },
      planningSeries: [],
    },
  ],
};

describe('CoachAssignments (§AJ)', () => {
  it('renders capabilities and active assignments only', async () => {
    mockApi(200, { ok: true, data: coach });
    render(<CoachAssignments />);
    expect(screen.getByRole('heading', { name: 'Mes affectations' })).toBeInTheDocument();
    expect(await screen.findByText(/Habilitations : maths-premiere, maths-terminale/)).toBeInTheDocument();
    expect(screen.getByText(/Yasmine Synthetic — maths-premiere/)).toBeInTheDocument();
    expect(screen.getByText(/2026-2027 · PREMIERE · Inscription active/)).toBeInTheDocument();
    expect(screen.getByText(/chaque mardi 18:00–19:00/)).toBeInTheDocument();
    expect(screen.queryByText(/Ancien Élève/)).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v2/coach/me', expect.objectContaining({ method: 'GET' }));
  });

  it('shows the empty state when no assignment is active, and an alert on failure', async () => {
    mockApi(200, { ok: true, data: { ...coach, assignments: [] } });
    render(<CoachAssignments />);
    expect(await screen.findByText('Aucune affectation active pour l’instant.')).toBeInTheDocument();

    mockApi(500, { ok: false, error: { code: 'INTERNAL', message: 'Boom' } });
    render(<CoachAssignments />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Boom');
  });
});
