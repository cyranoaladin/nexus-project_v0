import { ChildCard } from '@/components/dashboard/parent/ChildCard';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const child = {
  id: 'student-1',
  firstName: 'Enfant',
  lastName: 'Test',
  email: 'enfant.test@nexus-student.local',
  gradeLevel: 'SECONDE',
  academicTrack: 'EDS_GENERALE',
  activationStatus: 'PENDING_ACTIVATION' as const,
  activationExpiresAt: null,
};

describe('ChildCard initial student activation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets the owning parent issue and open a one-time activation link', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      activation: {
        activationUrl: 'http://localhost/auth/activate?token=act_raw_once',
        expiresAt: '2026-08-06T10:00:00.000Z',
        loginIdentifier: child.email,
        studentName: 'Enfant Test',
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    render(<ChildCard child={child} />);
    fireEvent.click(screen.getByRole('button', { name: /activer le compte élève/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      '/api/parent/children/student-1/activation',
      expect.objectContaining({ method: 'POST' }),
    ));
    expect(await screen.findByText(child.email)).toBeInTheDocument();
    expect(screen.getByText("Remettez ce lien à votre enfant pour qu'il passe son bilan.")).toBeInTheDocument();
    expect(screen.getByDisplayValue('http://localhost/auth/activate?token=act_raw_once')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ouvrir l.activation/i })).toHaveAttribute(
      'href',
      'http://localhost/auth/activate?token=act_raw_once',
    );
  });

  it('does not expose an activation action for an active child', () => {
    render(<ChildCard child={{ ...child, activationStatus: 'ACTIVE' }} />);

    expect(screen.queryByRole('button', { name: /activer le compte élève/i })).not.toBeInTheDocument();
  });

  it('does not disclose ownership details when activation is refused', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }));

    render(<ChildCard child={child} />);
    fireEvent.click(screen.getByRole('button', { name: /activer le compte élève/i }));

    expect(await screen.findByText(/activation indisponible/i)).toBeInTheDocument();
    expect(screen.queryByText(/not found/i)).not.toBeInTheDocument();
  });
});
