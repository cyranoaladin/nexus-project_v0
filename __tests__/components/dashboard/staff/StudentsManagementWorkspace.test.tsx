import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { StudentsManagementWorkspace } from '@/components/dashboard/staff/StudentsManagementWorkspace';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

const mockFetch = jest.fn();

class TestResponse {
  readonly ok: boolean;

  constructor(private readonly body: string, public readonly init: { status: number }) {
    this.ok = init.status >= 200 && init.status < 300;
  }

  get status() {
    return this.init.status;
  }

  async json() {
    return JSON.parse(this.body);
  }
}

Object.defineProperty(global, 'Response', { value: TestResponse, configurable: true });

describe('StudentsManagementWorkspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
  });

  it.each([
    ['ADMIN', '/dashboard/admin/candidat-individuel?studentId=student-1'],
    ['ASSISTANTE', '/dashboard/assistante/candidat-individuel?studentId=student-1'],
  ] as const)('propose le round-trip contextuel fermé pour %s', async (staffRole, expectedHref) => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{
      id: 'student-1', firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test',
      grade: 'Terminale', school: 'Lycée test', creditBalance: 0,
    }]), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole={staffRole} intent="candidat-individuel" />);

    expect(await screen.findByRole('heading', { name: 'Sélectionner un élève pour le devis candidat individuel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour au simulateur' })).toHaveAttribute(
      'href',
      staffRole === 'ADMIN' ? '/dashboard/admin/candidat-individuel' : '/dashboard/assistante/candidat-individuel',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Utiliser pour ce devis' }));
    expect(mockPush).toHaveBeenCalledWith(expectedHref);
    expect(screen.getByRole('button', { name: 'Créer et utiliser pour ce devis' })).toBeInTheDocument();
  });

  it('le mode normal ne montre aucune action contextuelle', async () => {
    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText('Sélectionner un élève pour le devis candidat individuel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Utiliser pour ce devis' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '+ Créer parent + élève' })).toBeInTheDocument();
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, studentId: 'student-new', contactLeadId: 'lead-new' }), { status: 201 }))
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

  it('crée puis utilise l’identifiant élève autoritatif en mode contextuel', async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      success: true,
      studentId: 'student-created',
      contactLeadId: 'lead-created',
    }), { status: 201 }));
    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
    await screen.findByText('Aucun élève trouvé');

    await user.click(screen.getByRole('button', { name: 'Créer parent + élève' }));
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'parent.context@test.tn' } });
    const firstNames = screen.getAllByLabelText('Prénom *');
    const lastNames = screen.getAllByLabelText('Nom *');
    fireEvent.change(firstNames[0], { target: { value: 'Sonia' } });
    fireEvent.change(lastNames[0], { target: { value: 'Contexte' } });
    fireEvent.change(screen.getByLabelText('Email élève *'), { target: { value: 'student.context@test.tn' } });
    fireEvent.change(firstNames[1], { target: { value: 'Yasmine' } });
    fireEvent.change(lastNames[1], { target: { value: 'Contexte' } });
    fireEvent.change(screen.getByLabelText(/Niveau/), { target: { value: 'Terminale' } });

    await user.click(screen.getByRole('button', { name: 'Créer et utiliser pour ce devis' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith(
      '/dashboard/assistante/candidat-individuel?studentId=student-created',
    ));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('contactLeadId'));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('email'));
  });
});
