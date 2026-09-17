import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { StudentEnrollments } from '@/components/dashboard/core-v2/StudentEnrollments';

function mockApi(status: number, body: unknown) {
  global.fetch = jest.fn(async () => ({ ok: status < 400, status, json: async () => body }) as unknown as Response) as unknown as typeof fetch;
}

const student = {
  id: 's1',
  birthDate: null,
  user: { id: 'u1', role: 'ELEVE', firstName: 'Yasmine', lastName: 'Synthetic', email: null, phone: null, accountStatus: 'ACTIVE', activatedAt: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
  parents: [{ id: 'p1', firstName: 'Amel', lastName: 'Synthetic', isPrimaryContact: true }],
  enrollments: [
    {
      id: 'e1', status: 'ACTIVE', academicYear: { id: 'y1', startYear: 2026, status: 'CURRENT' }, gradeLevel: 'PREMIERE', academicTrack: 'EDS_GENERALE', stmgPathway: null,
      schoolingStatus: null, school: null, academicRevision: 1, approvedAt: '2026-09-02T00:00:00Z',
      courses: [{ id: 'c1', courseKey: 'maths-premiere', kind: 'SPECIALTY' }],
      assignments: [
        {
          id: 'a1', courseKey: 'maths-premiere', status: 'ACTIVE', startsAt: '2026-09-02T00:00:00Z', endsAt: null,
          coach: { id: 'c-1', user: { id: 'u-c1', firstName: 'Coach', lastName: 'Synthetic' } },
          planningSeries: [{ id: 'ps1', status: 'ACTIVE', recurrenceRule: 'FREQ=WEEKLY;BYDAY=TU', localStartTime: '18:00', localEndTime: '19:00', timezone: 'Africa/Tunis', revision: 1 }],
        },
      ],
    },
  ],
};

describe('StudentEnrollments (§AI)', () => {
  it('renders the student’s own enrollments with course, coach and weekly slot', async () => {
    mockApi(200, { ok: true, data: student });
    render(<StudentEnrollments />);
    expect(await screen.findByRole('heading', { name: 'Mon parcours' })).toBeInTheDocument();
    expect(screen.getByText(/Yasmine Synthetic · Parents : Amel Synthetic/)).toBeInTheDocument();
    expect(screen.getByText(/2026-2027 · Inscription active/)).toBeInTheDocument();
    expect(screen.getByText(/maths-premiere — Coach Synthetic/)).toBeInTheDocument();
    expect(screen.getByText(/chaque mardi 18:00–19:00 \(Africa\/Tunis\)/)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith('/api/v2/student/me', expect.objectContaining({ method: 'GET' }));
  });

  it('explains a 404 (no student record) as information, other failures as an alert', async () => {
    mockApi(404, { ok: false, error: { code: 'NOT_FOUND', message: 'x' } });
    render(<StudentEnrollments />);
    expect(await screen.findByText(/Aucune fiche élève n’est encore rattachée/)).toHaveAttribute('role', 'status');

    mockApi(503, { ok: false, error: { code: 'CORE_V2_UNAVAILABLE', message: 'x' } });
    render(<StudentEnrollments />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Le référentiel Core v2 n’est pas configuré sur ce déploiement.');
  });
});
