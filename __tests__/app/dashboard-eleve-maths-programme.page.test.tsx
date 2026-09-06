import { render, screen } from '@testing-library/react';

import DashboardEleveMathsProgrammePage from '@/app/dashboard/eleve/programme/maths/page';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

jest.mock('@/app/programme/maths-1ere/components/MathsRevisionClient', () => ({
  __esModule: true,
  default: ({ user }: { user: { id: string; role?: string } }) => (
    <div data-testid="maths-revision-client">{user.id}:{user.role ?? 'missing-role'}</div>
  ),
}));

const mockAuth = auth as unknown as jest.Mock;
const mockStudentFindUnique = prisma.student.findUnique as unknown as jest.Mock;

describe('student Maths programme RAG identity context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the explicit ELEVE role to the shared Cockpit', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'student-1', role: 'ELEVE', firstName: 'Nour' },
    });
    mockStudentFindUnique.mockResolvedValue({ academicTrack: 'EDS_GENERALE' });

    render(await DashboardEleveMathsProgrammePage());

    expect(screen.getByTestId('maths-revision-client')).toHaveTextContent('student-1:ELEVE');
  });
});
