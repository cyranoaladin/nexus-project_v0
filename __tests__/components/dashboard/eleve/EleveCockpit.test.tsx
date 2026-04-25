import { render, screen } from '@testing-library/react';
import { EleveCockpit } from '@/components/dashboard/eleve';
import type { EleveDashboardData } from '@/components/dashboard/eleve';

const baseData: EleveDashboardData = {
  student: {
    id: 'student-1',
    firstName: 'Nour',
    lastName: 'Ben Ali',
    email: 'nour@example.com',
    grade: 'PREMIERE',
    gradeLevel: 'PREMIERE',
    academicTrack: 'EDS_GENERALE',
    specialties: ['MATHEMATIQUES'],
    stmgPathway: null,
    school: null,
  },
  nextSession: null,
  recentSessions: [],
  sessionsCount: 0,
  ariaStats: { messagesToday: 1, totalConversations: 3 },
  badges: [],
};

describe('EleveCockpit', () => {
  it('renders track metadata and ARIA counters', () => {
    render(<EleveCockpit data={baseData} />);

    expect(screen.getByText('Cockpit du jour')).toBeInTheDocument();
    expect(screen.getByText('PREMIERE · EDS_GENERALE')).toBeInTheDocument();
    expect(screen.getByText('conversations pédagogiques')).toBeInTheDocument();
  });
});
