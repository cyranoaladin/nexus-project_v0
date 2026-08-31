import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { StudentsManagementWorkspace } from '@/components/dashboard/staff/StudentsManagementWorkspace';

const mockPush = jest.fn();
const directoryStudent = {
  studentId: 'student-db-1',
  displayName: 'Yasmine Ben Salah',
  email: 'student@example.test',
  grade: 'Terminale',
  school: 'Lycée test',
  selectable: true as const,
  unavailableReason: null,
};

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
    window.sessionStorage.clear();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
  });

  it.each([
    ['ADMIN', '/dashboard/admin/candidat-individuel'],
    ['ASSISTANTE', '/dashboard/assistante/candidat-individuel'],
  ] as const)('propose le round-trip contextuel fermé pour %s', async (staffRole, expectedHref) => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole={staffRole} intent="candidat-individuel" />);

    expect(await screen.findByRole('heading', { name: 'Sélectionner un élève pour le devis candidat individuel' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour au simulateur' })).toHaveAttribute(
      'href',
      staffRole === 'ADMIN' ? '/dashboard/admin/candidat-individuel' : '/dashboard/assistante/candidat-individuel',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Utiliser pour ce devis' }));
    expect(mockPush).toHaveBeenCalledWith(expectedHref);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-db-1');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('studentId'));
    expect(screen.getByRole('button', { name: 'Créer et utiliser pour ce devis' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', page: 1, limit: 20 }),
      signal: expect.any(AbortSignal),
    }));
    expect(mockFetch.mock.calls.some(([url]) => url === '/api/assistante/students/credits')).toBe(false);
    expect(JSON.stringify(directoryStudent)).not.toContain('creditBalance');
  });

  it.each([
    'Compte élève fusionné',
    'Responsable absent',
    'Compte responsable fusionné',
    'Adresse email du responsable manquante',
    'Nom du responsable manquant',
  ] as const)('affiche mais désactive un dossier indisponible avec une justification humaine: %s', async (reason) => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [{ ...directoryStudent, selectable: false, unavailableReason: reason }],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    const explanation = await screen.findByText(reason);
    const action = screen.getByRole('button', { name: 'Utiliser pour ce devis' });
    expect(action).toBeDisabled();
    expect(action).toHaveAttribute('aria-describedby', explanation.id);
    await userEvent.click(action);
    expect(mockPush).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
  });

  it('recherche et pagine le répertoire contextuel côté serveur', async () => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
        items: [directoryStudent],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        items: [directoryStudent],
      }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
    const search = await screen.findByPlaceholderText('Rechercher un élève...');
    fireEvent.change(search, { target: { value: 'Yasmine' } });

    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(
      '/api/assistante/candidat-individuel/students/search',
      expect.objectContaining({ body: JSON.stringify({ query: 'Yasmine', page: 1, limit: 20 }), signal: expect.any(AbortSignal) }),
    ));
    expect(screen.queryByText('Avec Crédits')).not.toBeInTheDocument();
  });

  it('retire immédiatement les anciennes lignes pendant un changement de page', async () => {
    let resolveSecond!: (value: Response) => void;
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        pagination: { page: 1, limit: 20, total: 21, totalPages: 2 },
        items: [directoryStudent],
      }), { status: 200 }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveSecond = resolve; }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    await screen.findByText('Yasmine Ben Salah');
    await userEvent.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.queryByText('Yasmine Ben Salah')).not.toBeInTheDocument();

    resolveSecond(new Response(JSON.stringify({
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
      items: [{ ...directoryStudent, studentId: 'student-db-2', displayName: 'Nadia Ben Salah' }],
    }), { status: 200 }));
    expect(await screen.findByText('Nadia Ben Salah')).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({ body: JSON.stringify({ query: '', page: 2, limit: 20 }) }));
  });

  it('garde le champ de recherche monté pendant le debounce et la requête', async () => {
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        items: [directoryStudent],
      }), { status: 200 }))
      .mockReturnValueOnce(new Promise<Response>(() => undefined));

    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
    const search = await screen.findByPlaceholderText('Rechercher un élève...');
    fireEvent.change(search, { target: { value: 'Y' } });

    expect(screen.getByPlaceholderText('Rechercher un élève...')).toHaveValue('Y');
    expect(screen.queryByText('Yasmine Ben Salah')).not.toBeInTheDocument();
    expect(screen.getByText('Recherche en cours...')).toBeInTheDocument();
  });

  it('échoue fermé sur un payload contextuel 200 mal formé', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ items: 'invalid' }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    expect(await screen.findByText('Erreur lors du chargement')).toBeInTheDocument();
    expect(screen.getByText('Le répertoire des élèves a retourné une réponse invalide.')).toBeInTheDocument();
  });

  it('le mode normal ne montre aucune action contextuelle', async () => {
    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.queryByText('Sélectionner un élève pour le devis candidat individuel')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Utiliser pour ce devis' })).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '+ Créer parent + élève' })).toBeInTheDocument();
  });

  it('préserve le mode normal ASSISTANTE avec Fiche, Gérer Crédits et l’annuaire crédits', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{
      id: 'student-1', firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test',
      grade: 'Terminale', school: 'Lycée test', creditBalance: 0,
    }]), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" />);

    expect(await screen.findByRole('button', { name: 'Fiche' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gérer Crédits' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/assistante/students/credits');
  });

  it('préserve et améliore le mode normal ADMIN avec une action de devis autoritative', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{
      id: 'student-admin-1', firstName: 'Yasmine', lastName: 'Ben Salah', email: 'student@example.test',
      grade: 'Terminale', school: 'Lycée test', creditBalance: 0,
    }]), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Utiliser pour un devis candidat individuel' }));

    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-admin-1');
    expect(mockPush).toHaveBeenCalledWith('/dashboard/admin/candidat-individuel');
  });

  it('verrouille la sélection après le premier élève pour éviter un handoff concurrent', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      items: [
        directoryStudent,
        { ...directoryStudent, studentId: 'student-db-2', displayName: 'Nadia Ben Salah' },
      ],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const actions = await screen.findAllByRole('button', { name: 'Utiliser pour ce devis' });
    fireEvent.click(actions[0]);
    fireEvent.click(actions[1]);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-db-1');
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).not.toContain('student-db-2');
  });

  it('réarme la sélection si la page est restaurée depuis l’historique', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      items: [
        directoryStudent,
        { ...directoryStudent, studentId: 'student-db-2', displayName: 'Nadia Ben Salah' },
      ],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const actions = await screen.findAllByRole('button', { name: 'Utiliser pour ce devis' });
    fireEvent.click(actions[0]);
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Utiliser pour ce devis' })[1]).toBeDisabled());
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Utiliser pour ce devis' })[1]).toBeEnabled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Utiliser pour ce devis' })[1]);
    expect(mockPush).toHaveBeenCalledTimes(2);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-db-2');
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
    mockFetch.mockReset();
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        items: [],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
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

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/assistante/candidat-individuel'));
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-created');
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('contactLeadId'));
    expect(mockPush).not.toHaveBeenCalledWith(expect.stringContaining('email'));
  });
});
