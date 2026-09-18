import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ParentHousehold } from '@/components/dashboard/core-v2/ParentHousehold';

// The main read model is mocked with the given status/body; the embedded
// "Prochaines séances" list (self-service /planning range) answers empty.
function mockApi(status: number, body: unknown) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    if (String(input).includes('/planning?')) return { ok: true, status: 200, json: async () => ({ ok: true, data: [] }) } as unknown as Response;
    return { ok: status < 400, status, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

const user = (id: string, role: string, first: string, accountStatus: string) => ({
  id, role, firstName: first, lastName: 'Synthetic', email: null, phone: null, accountStatus, activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
});

const household = {
  id: 'h1',
  createdAt: '2026-09-01T00:00:00Z',
  parents: [{ ...user('p1', 'PARENT', 'Amel', 'ACTIVE'), isPrimaryContact: true }],
  students: [
    {
      id: 's1',
      birthDate: null,
      user: user('u-s1', 'ELEVE', 'Yasmine', 'PENDING_ACTIVATION'),
      enrollments: [
        {
          id: 'e1', status: 'ACTIVE', academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' }, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null,
          schoolingStatus: null, school: null, academicRevision: 1, approvedAt: '2026-09-02T00:00:00Z',
          courses: [{ id: 'c1', courseKey: 'maths-premiere', kind: 'SPECIALTY' }],
          assignments: [
            {
              id: 'a1', courseKey: 'maths-premiere', status: 'ACTIVE', startsAt: '2026-09-02T00:00:00Z', endsAt: null,
              coach: { id: 'c-1', user: { id: 'u-c1', firstName: 'Coach', lastName: 'Synthetic' } },
              planningSeries: [
                { id: 'ps1', status: 'ACTIVE', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', localStartTime: '18:00', localEndTime: '19:00', timezone: 'Africa/Tunis', revision: 1 },
                { id: 'ps2', status: 'CANCELLED', recurrenceRule: 'FREQ=WEEKLY;BYDAY=FR', localStartTime: '10:00', localEndTime: '11:00', timezone: 'Africa/Tunis', revision: 1 },
              ],
            },
            { id: 'a2', courseKey: 'physique', status: 'ENDED', startsAt: '2026-09-02T00:00:00Z', endsAt: '2026-09-03T00:00:00Z', coach: { id: 'c-2', user: { id: 'u-c2', firstName: 'Ancien', lastName: 'Coach' } }, planningSeries: [] },
          ],
        },
        { id: 'e2', status: 'PENDING', academicYear: { id: 'y0', startYear: 2025, status: 'CLOSED' }, gradeLevel: 'SECONDE', academicTrack: 'EDS_GENERALE', stmgPathway: null, schoolingStatus: null, school: null, academicRevision: 1, approvedAt: null, courses: [], assignments: [] },
      ],
    },
  ],
};

describe('ParentHousehold (§AH)', () => {
  it('renders the household read model: children, enrollments, explicit courses, active coach and active series only', async () => {
    mockApi(200, { ok: true, data: household });
    render(<ParentHousehold />);

    expect(await screen.findByRole('heading', { name: 'Mon foyer' })).toBeInTheDocument();
    expect(screen.getByText(/Parents : Amel Synthetic \(actif\)/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Yasmine Synthetic' })).toBeInTheDocument();
    expect(screen.getByText(/2026-2027 · Inscription active/)).toBeInTheDocument();
    expect(screen.getByText(/2025-2026 · En attente de validation/)).toBeInTheDocument();
    expect(screen.getByText(/maths-premiere — Coach Synthetic/)).toBeInTheDocument();
    expect(screen.getByText(/chaque mardi 18:00–19:00 \(Africa\/Tunis\)/)).toBeInTheDocument();
    // Non-active series and ended assignments are not shown to the family.
    expect(screen.queryByText(/chaque vendredi/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ancien Coach/)).not.toBeInTheDocument();
    expect(screen.getByText('Aucun coach affecté pour l’instant.')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v2/parent/household', expect.objectContaining({ method: 'GET' }));
  });

  it('explains a 404 (account not attached to any household) without an error tone', async () => {
    mockApi(404, { ok: false, error: { code: 'NOT_FOUND', message: 'No household is attached to this account.' } });
    render(<ParentHousehold />);
    const status = await screen.findByText(/Aucun foyer n’est encore rattaché à votre compte\./);
    expect(status).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('surfaces other failures as an alert with the API message', async () => {
    mockApi(503, { ok: false, error: { code: 'CORE_V2_UNAVAILABLE', message: 'x' } });
    render(<ParentHousehold />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Le référentiel Core v2 n’est pas configuré sur ce déploiement.');
  });
});
