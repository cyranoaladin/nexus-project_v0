import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { StudentsManagementWorkspace } from '@/components/dashboard/staff/StudentsManagementWorkspace';

jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const mockFetch = jest.fn();

describe('StudentsManagementWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
  });

  it.each([
    ['ADMIN', '/dashboard/admin', '/dashboard/admin/candidat-individuel'],
    ['ASSISTANTE', '/dashboard/assistante', '/dashboard/assistante/credits'],
  ] as const)('uses role-aware destinations for %s', async (staffRole, homeHref, actionHref) => {
    render(<StudentsManagementWorkspace staffRole={staffRole} />);

    expect(await screen.findByRole('link', { name: /Gestion des Élèves/i })).toHaveAttribute('href', homeHref);
    expect(screen.getByRole('link', { name: staffRole === 'ADMIN' ? /Retour au simulateur/i : /Gérer les Crédits/i })).toHaveAttribute('href', actionHref);
  });

  it('reste filtrable lorsque les champs optionnels d\'un élève sont null', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{
      id: 'student-nullable',
      firstName: 'Yasmine',
      lastName: null,
      email: null,
      grade: 'TERMINALE',
      school: null,
      creditBalance: 0,
    }]), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" />);
    expect(await screen.findByText(/Yasmine/)).toBeInTheDocument();

    const searchInput = screen.getAllByRole('textbox').find((input) =>
      input.getAttribute('placeholder')?.toLowerCase().includes('rechercher'),
    );
    expect(searchInput).toBeDefined();
    await user.type(searchInput!, 'introuvable');

    expect(await screen.findByText('Aucun élève trouvé')).toBeInTheDocument();
  });

  it('preserves parent + student creation and refreshes the selectable list', async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ studentId: 'student-new', parentId: 'parent-new' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'student-new', firstName: 'Yasmine', lastName: 'Ben Salah', email: 'yasmine@test.tn', grade: 'TERMINALE', school: 'PMF', creditBalance: 0 }]), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" />);
    await screen.findByText('Aucun élève trouvé');

    await user.click(screen.getByRole('button', { name: '+ Créer parent + élève' }));
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'parent@test.tn' } });
    const firstNames = screen.getAllByLabelText('Prénom *');
    const lastNames = screen.getAllByLabelText('Nom *');
    fireEvent.change(firstNames[0], { target: { value: 'Sonia' } });
    fireEvent.change(lastNames[0], { target: { value: 'Ben Salah' } });
    fireEvent.change(screen.getByLabelText('Téléphone'), { target: { value: '+21699111222' } });
    fireEvent.change(screen.getByLabelText('Email élève *'), { target: { value: 'yasmine@test.tn' } });
    fireEvent.change(firstNames[1], { target: { value: 'Yasmine' } });
    fireEvent.change(lastNames[1], { target: { value: 'Ben Salah' } });
    fireEvent.change(screen.getByLabelText(/Niveau/), { target: { value: 'Terminale' } });
    fireEvent.change(screen.getByLabelText('École'), { target: { value: 'PMF' } });
    expect(screen.getByLabelText('Email *')).toHaveValue('parent@test.tn');
    expect(firstNames[0]).toHaveValue('Sonia');
    expect(lastNames[0]).toHaveValue('Ben Salah');
    await user.click(screen.getByRole('button', { name: 'Créer' }));
    expect(screen.queryByText(/Renseignez au minimum/)).not.toBeInTheDocument();

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/assistante/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parentEmail: 'parent@test.tn', parentFirstName: 'Sonia', parentLastName: 'Ben Salah', parentPhone: '+21699111222',
        studentFirstName: 'Yasmine', studentLastName: 'Ben Salah', studentEmail: 'yasmine@test.tn', studentGrade: 'Terminale', studentSchool: 'PMF',
      }),
    }));
    expect(await screen.findByText('Yasmine Ben Salah')).toBeInTheDocument();
  });
});
