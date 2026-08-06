import { render, screen } from '@testing-library/react';

import { PriorityAlerts, type CoachAlert } from '@/components/dashboard/coach/PriorityAlerts';

describe('PriorityAlerts', () => {
  it('renders a BILAN_PENDING alert as emitted by /api/coach/dashboard, including its studentId', () => {
    // This is the exact shape emitted by app/api/coach/dashboard/route.ts for
    // students with a pending bilan — the CoachAlert type must accept it honestly,
    // not merely pass a type assertion that lies about the real payload.
    const alerts: CoachAlert[] = [
      {
        id: 'bilan-student-1',
        studentName: 'Amine',
        studentId: 'student-1',
        message: 'Bilan diagnostic Maths Terminale à corriger.',
        type: 'BILAN_PENDING',
        priority: 'HIGH',
      },
    ];

    render(<PriorityAlerts alerts={alerts} />);

    expect(screen.getByText('Amine')).toBeInTheDocument();
    expect(screen.getByText('Bilan diagnostic Maths Terminale à corriger.')).toBeInTheDocument();
  });

  it('still renders the other known alert types without studentId', () => {
    const alerts: CoachAlert[] = [
      { id: 'a1', studentName: 'Sami', message: 'Retard critique.', type: 'STAGNATION', priority: 'HIGH' },
      { id: 'a2', studentName: 'Yasmine', message: 'Baisse d\'activité.', type: 'ABSENCE', priority: 'MEDIUM' },
    ];

    render(<PriorityAlerts alerts={alerts} />);

    expect(screen.getByText('Sami')).toBeInTheDocument();
    expect(screen.getByText('Yasmine')).toBeInTheDocument();
  });
});
