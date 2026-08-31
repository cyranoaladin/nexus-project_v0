import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import userEvent from '@testing-library/user-event';

import { StudentsManagementWorkspace } from '@/components/dashboard/staff/StudentsManagementWorkspace';
import {
  CANDIDATE_STUDENT_HANDOFF_KEY,
  CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS,
  getCandidateSimulatorPath,
} from '@/lib/quotes/candidat-individuel-navigation';
import type { CandidatIndividuelStudentSearchItem } from '@/lib/quotes/candidat-individuel-search-contracts';

const mockNativeNavigate = jest.fn();
const mockNativeReload = jest.fn();
const directoryStudent = {
  studentId: 'student-db-1',
  displayName: 'Yasmine Ben Salah',
  email: 'student@example.test',
  grade: 'Terminale',
  school: 'Lycée test',
  selectable: true as const,
  unavailableReason: null,
};

const unavailableDirectoryStudents = [
  { studentId: 'student-unavailable-1', displayName: 'Élève fusionné', email: 'student1@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Compte élève fusionné' },
  { studentId: 'student-unavailable-2', displayName: 'Élève sans responsable', email: 'student2@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Responsable absent' },
  { studentId: 'student-unavailable-3', displayName: 'Élève responsable fusionné', email: 'student3@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Compte responsable fusionné' },
  { studentId: 'student-unavailable-4', displayName: 'Élève sans email responsable', email: 'student4@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Adresse email du responsable manquante' },
  { studentId: 'student-unavailable-5', displayName: 'Élève sans nom responsable', email: 'student5@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Nom du responsable manquant' },
] satisfies CandidatIndividuelStudentSearchItem[];

jest.mock('@/lib/quotes/candidat-individuel-navigation', () => ({
  ...jest.requireActual('@/lib/quotes/candidat-individuel-navigation'),
  navigateCandidateSimulatorSameTab: (...args: unknown[]) => mockNativeNavigate(...args),
  reloadCandidateStudentSourcePage: (...args: unknown[]) => mockNativeReload(...args),
}));

jest.mock('next-auth/react', () => ({ signOut: jest.fn() }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a data-next-link="true" {...props}>{children}</a>
  ),
}));
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
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
  const navigationAttempts: Array<{ type: string; defaultPreventedBeforeTrap: boolean }> = [];
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let windowStopSpy: jest.SpyInstance;

  const trapCandidateNavigation = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest('a');
    if (!anchor?.textContent?.includes('Utiliser pour')) return;
    const href = anchor.getAttribute('href');
    if (href !== '/dashboard/admin/candidat-individuel' && href !== '/dashboard/assistante/candidat-individuel') return;
    navigationAttempts.push({ type: event.type, defaultPreventedBeforeTrap: event.defaultPrevented });
    event.preventDefault();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    navigationAttempts.length = 0;
    document.addEventListener('click', trapCandidateNavigation);
    document.addEventListener('auxclick', trapCandidateNavigation);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    windowStopSpy = jest.spyOn(window, 'stop').mockImplementation(() => undefined);
    window.sessionStorage.clear();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
  });

  afterEach(() => {
    jest.useRealTimers();
    document.removeEventListener('click', trapCandidateNavigation);
    document.removeEventListener('auxclick', trapCandidateNavigation);
    const consoleErrors = consoleErrorSpy.mock.calls;
    const consoleWarnings = consoleWarnSpy.mock.calls;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    windowStopSpy.mockRestore();
    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
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
    const selectLink = screen.getByRole('link', { name: 'Utiliser pour ce devis' });
    expect(selectLink).toHaveAttribute('href', expectedHref);
    expect(selectLink).not.toHaveAttribute('data-next-link');
    fireEvent.click(selectLink, { button: 0, detail: 1 });
    expect(navigationAttempts).toEqual([{ type: 'click', defaultPreventedBeforeTrap: false }]);
    expect(mockNativeNavigate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-db-1');
    expect(expectedHref).not.toContain('studentId');
    expect(screen.getByRole('button', { name: 'Vérifier avant création' })).toBeInTheDocument();
    expect(mockFetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '', page: 1, limit: 20 }),
      signal: expect.any(AbortSignal),
    }));
    expect(mockFetch.mock.calls.some(([url]) => url === '/api/assistante/students/credits')).toBe(false);
    expect(JSON.stringify(directoryStudent)).not.toContain('creditBalance');
  });

  it('purge un handoff résiduel au montage avant d’autoriser retour et nouvelle sélection', async () => {
    window.sessionStorage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, JSON.stringify({
      version: 1,
      studentId: 'student-stale-1',
      role: 'ADMIN',
      createdAt: Date.now(),
    }));
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(screen.getByRole('link', { name: 'Retour au simulateur' })).toHaveAttribute(
      'href',
      '/dashboard/admin/candidat-individuel',
    );
    expect(action).toHaveAttribute('aria-disabled', 'false');
    fireEvent.click(action, { button: 0, detail: 1 });
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
  });

  it('reste terminal au montage si la purge échoue puis récupère après rechargement et remount', async () => {
    window.sessionStorage.setItem(CANDIDATE_STUDENT_HANDOFF_KEY, JSON.stringify({
      version: 1,
      studentId: 'student-stale-2',
      role: 'ADMIN',
      createdAt: Date.now(),
    }));
    const removalFailure = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));

    const mounted = render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    expect(screen.getByRole('alert')).toHaveTextContent('Rechargez cette page pour reprendre.');
    expect(action).toHaveAttribute('aria-disabled', 'true');
    const returnToSimulator = screen.getByRole('link', { name: 'Retour au simulateur' });
    expect(returnToSimulator).toHaveAttribute('aria-disabled', 'true');
    expect(returnToSimulator).toHaveAttribute('tabindex', '-1');
    expect(fireEvent.click(returnToSimulator)).toBe(false);
    expect(screen.getByRole('button', { name: 'Créer parent + élève' })).toBeDisabled();
    expect(mockNativeReload).not.toHaveBeenCalled();
    fireEvent.click(action, { button: 0, detail: 1 });
    expect(navigationAttempts.at(-1)).toEqual({ type: 'click', defaultPreventedBeforeTrap: true });
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain('student-stale-2');
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(mockNativeReload).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain('student-stale-2');

    mounted.unmount();
    removalFailure.mockRestore();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    await waitFor(() => expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull());
    expect(await screen.findByRole('link', { name: 'Utiliser pour ce devis' })).toHaveAttribute('aria-disabled', 'false');
  });

  it.each(unavailableDirectoryStudents)('affiche une action focusable mais inerte avec une justification humaine: $unavailableReason', async (student) => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [student],
    }), { status: 200 }));

    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    const explanation = await screen.findByText(student.unavailableReason);
    const action = screen.getByRole('link', { name: 'Utiliser pour ce devis' });
    expect(action).not.toBeDisabled();
    expect(action).toHaveAttribute('aria-disabled', 'true');
    expect(action).toHaveAttribute('aria-describedby', explanation.id);
    action.focus();
    expect(action).toHaveFocus();
    const user = userEvent.setup();
    await user.click(action);
    await user.keyboard('{Enter}');
    expect(navigationAttempts).toEqual([
      { type: 'click', defaultPreventedBeforeTrap: true },
      { type: 'click', defaultPreventedBeforeTrap: true },
    ]);
    expect(mockNativeNavigate).not.toHaveBeenCalled();
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
    const candidateLink = await screen.findByRole('link', { name: 'Utiliser pour un devis candidat individuel' });
    expect(candidateLink).toHaveAttribute('href', '/dashboard/admin/candidat-individuel');
    expect(candidateLink).not.toHaveAttribute('data-next-link');
    fireEvent.click(candidateLink, { button: 0, detail: 1 });

    expect(navigationAttempts).toEqual([{ type: 'click', defaultPreventedBeforeTrap: false }]);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-admin-1');
    expect(mockNativeNavigate).not.toHaveBeenCalled();
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
    const actions = await screen.findAllByRole('link', { name: 'Utiliser pour ce devis' });
    fireEvent.click(actions[0]);
    fireEvent.click(actions[1]);

    expect(mockNativeNavigate).not.toHaveBeenCalled();
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
    const actions = await screen.findAllByRole('link', { name: 'Utiliser pour ce devis' });
    fireEvent.click(actions[0]);
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Utiliser pour ce devis' })[1]).toHaveAttribute('aria-disabled', 'true'));
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Utiliser pour ce devis' })[1]).toHaveAttribute('aria-disabled', 'false'));
    fireEvent.click(screen.getAllByRole('link', { name: 'Utiliser pour ce devis' })[1]);
    expect(mockNativeNavigate).not.toHaveBeenCalled();
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
    const mounted = render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
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

    await user.click(screen.getByRole('button', { name: 'Vérifier avant création' }));

    expect(screen.getByRole('heading', { name: 'Confirmer la création des comptes Nexus' })).toBeInTheDocument();
    expect(screen.getByText(/créer ou mettre à jour les comptes Nexus du responsable et de l’élève/i)).toBeInTheDocument();
    expect(screen.getByText(/email d’activation du compte élève/i)).toBeInTheDocument();
    expect(screen.getByText(/email de définition ou de réinitialisation du mot de passe du responsable/i)).toBeInTheDocument();
    let cancel = screen.getByRole('button', { name: 'Annuler la création' });
    let confirm = screen.getByRole('button', { name: 'Créer les comptes et utiliser pour ce devis' });
    expect(cancel).toHaveFocus();
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(0);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('heading', { name: 'Confirmer la création des comptes Nexus' })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Vérifier avant création' }));
    cancel = screen.getByRole('button', { name: 'Annuler la création' });
    confirm = screen.getByRole('button', { name: 'Créer les comptes et utiliser pour ce devis' });
    expect(cancel).toHaveFocus();
    await user.tab();
    expect(confirm).toHaveFocus();
    jest.useFakeTimers();
    const confirmationKeyboard = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await confirmationKeyboard.keyboard(' '); // bouton de confirmation

    await waitFor(() => expect(mockNativeNavigate).toHaveBeenCalledWith(window.location, 'ASSISTANTE'));
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(1);
    expect(mockNativeNavigate).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toContain('student-created');
    expect(mockNativeNavigate).not.toHaveBeenCalledWith(expect.stringContaining('contactLeadId'));
    expect(mockNativeNavigate).not.toHaveBeenCalledWith(expect.stringContaining('email'));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });
    expect(windowStopSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Les comptes ont été créés');
    expect(screen.getByRole('button', { name: 'Créer parent + élève' })).toBeDisabled();
    const retry = screen.getByRole('button', { name: 'Réessayer d’ouvrir le simulateur' });
    retry.focus();
    await confirmationKeyboard.keyboard(' '); // bouton de retry navigation
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(1);
    expect(mockNativeNavigate).toHaveBeenCalledTimes(2);

    fireEvent(window, new PageTransitionEvent('pagehide'));
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    mockNativeNavigate.mockImplementationOnce(() => {
      throw new Error('location.assign failed');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer d’ouvrir le simulateur' }));
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(1);
    expect(mockNativeNavigate).toHaveBeenCalledTimes(3);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Les comptes ont été créés');

    fireEvent.click(screen.getByRole('button', { name: 'Réessayer d’ouvrir le simulateur' }));
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(1);
    expect(mockNativeNavigate).toHaveBeenCalledTimes(4);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain('student-created');
    mounted.unmount();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      items: [],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  it('annule la confirmation contextuelle sans POST, mutation ni staging', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      items: [],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    await screen.findByText('Aucun élève trouvé');
    await user.click(screen.getByRole('button', { name: 'Créer parent + élève' }));
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'parent.cancel@test.tn' } });
    const firstNames = screen.getAllByLabelText('Prénom *');
    const lastNames = screen.getAllByLabelText('Nom *');
    fireEvent.change(firstNames[0], { target: { value: 'Sonia' } });
    fireEvent.change(lastNames[0], { target: { value: 'Cancel' } });
    fireEvent.change(screen.getByLabelText('Email élève *'), { target: { value: 'student.cancel@test.tn' } });
    fireEvent.change(firstNames[1], { target: { value: 'Yasmine' } });
    fireEvent.change(lastNames[1], { target: { value: 'Cancel' } });
    fireEvent.change(screen.getByLabelText(/Niveau/), { target: { value: 'Terminale' } });

    await user.click(screen.getByRole('button', { name: 'Vérifier avant création' }));
    await user.click(screen.getByRole('button', { name: 'Annuler la création' }));

    expect(screen.queryByRole('heading', { name: 'Confirmer la création des comptes Nexus' })).not.toBeInTheDocument();
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(0);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(mockNativeNavigate).not.toHaveBeenCalled();
  });

  it('valide les emails côté client et relie le message au champ concerné', async () => {
    const user = userEvent.setup();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      items: [],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    await screen.findByText('Aucun élève trouvé');
    await user.click(screen.getByRole('button', { name: 'Créer parent + élève' }));
    fireEvent.change(screen.getByLabelText('Email *'), { target: { value: 'responsable-invalide' } });
    const firstNames = screen.getAllByLabelText('Prénom *');
    const lastNames = screen.getAllByLabelText('Nom *');
    fireEvent.change(firstNames[0], { target: { value: 'Sonia' } });
    fireEvent.change(lastNames[0], { target: { value: 'Validation' } });
    fireEvent.change(screen.getByLabelText('Email élève *'), { target: { value: 'eleve@test.tn' } });
    fireEvent.change(firstNames[1], { target: { value: 'Yasmine' } });
    fireEvent.change(lastNames[1], { target: { value: 'Validation' } });
    fireEvent.change(screen.getByLabelText(/Niveau/), { target: { value: 'Terminale' } });

    await user.click(screen.getByRole('button', { name: 'Vérifier avant création' }));

    const parentEmail = screen.getByLabelText('Email *');
    expect(parentEmail).toHaveAttribute('aria-invalid', 'true');
    expect(parentEmail).toHaveAttribute('aria-describedby', 'student-create-error');
    expect(screen.getByText('Email du responsable invalide.')).toHaveAttribute('id', 'student-create-error');
    expect(screen.queryByRole('heading', { name: 'Confirmer la création des comptes Nexus' })).not.toBeInTheDocument();

    fireEvent.change(parentEmail, { target: { value: 'responsable@test.tn' } });
    fireEvent.change(screen.getByLabelText('Email élève *'), { target: { value: 'eleve-invalide' } });
    await user.click(screen.getByRole('button', { name: 'Vérifier avant création' }));

    const studentEmail = screen.getByLabelText('Email élève *');
    expect(studentEmail).toHaveAttribute('aria-invalid', 'true');
    expect(studentEmail).toHaveAttribute('aria-describedby', 'student-create-error');
    expect(screen.getByText('Email de l’élève invalide.')).toHaveAttribute('id', 'student-create-error');
    expect(mockFetch.mock.calls.filter(([url, init]) => url === '/api/assistante/students' && init?.method === 'POST')).toHaveLength(0);
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
    ['Shift', { shiftKey: true }],
    ['Alt', { altKey: true }],
  ])('ne stage ni ne navigue avec un clic %s', async (_label, modifier) => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    fireEvent.click(action, { button: 0, detail: 1, ...modifier });

    expect(navigationAttempts).toEqual([{ type: 'click', defaultPreventedBeforeTrap: true }]);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(mockNativeNavigate).not.toHaveBeenCalled();
  });

  it('ne divulgue aucun identifiant élève dans URL, localStorage, analytics ou console', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    window.localStorage.clear();
    const dataLayer: unknown[] = [];
    Object.defineProperty(window, 'dataLayer', { value: dataLayer, configurable: true, writable: true });
    const consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
    ];
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Utiliser pour ce devis' }), { button: 0, detail: 1 });

    expect(getCandidateSimulatorPath('ADMIN')).not.toContain(directoryStudent.studentId);
    expect(window.location.href).not.toContain(directoryStudent.studentId);
    expect(Array.from({ length: window.localStorage.length }, (_, index) => {
      const key = window.localStorage.key(index);
      return key == null ? '' : `${key}:${window.localStorage.getItem(key)}`;
    }).join('\n')).not.toContain(directoryStudent.studentId);
    expect(JSON.stringify(dataLayer)).not.toContain(directoryStudent.studentId);
    expect(JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls))).not.toContain(directoryStudent.studentId);
    consoleSpies.forEach((spy) => spy.mockRestore());
    Reflect.deleteProperty(window, 'dataLayer');
  });

  it('ne stage ni ne navigue au clic milieu', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    fireEvent(action, new MouseEvent('auxclick', {
      bubbles: true,
      cancelable: true,
      button: 1,
      detail: 1,
    }));

    expect(navigationAttempts).toEqual([{ type: 'auxclick', defaultPreventedBeforeTrap: true }]);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(mockNativeNavigate).not.toHaveBeenCalled();
  });

  it('stage au clavier avec Entrée puis laisse le lien piloter la navigation', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    const user = userEvent.setup();
    render(<StudentsManagementWorkspace staffRole="ASSISTANTE" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });
    action.focus();
    await user.tab({ shift: true });
    await user.tab();
    expect(action).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(navigationAttempts).toEqual([{ type: 'click', defaultPreventedBeforeTrap: false }]);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(action).toHaveAttribute('href', '/dashboard/assistante/candidat-individuel');
    expect(mockNativeNavigate).not.toHaveBeenCalled();
  });

  it('conserve le handoff si stop échoue puis le purge au remount après rechargement manuel', async () => {
    jest.useFakeTimers();
    windowStopSpy.mockImplementationOnce(() => {
      throw new Error('navigation still pending');
    });
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    const mounted = render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Utiliser pour ce devis' }), { button: 0, detail: 1 });
    });
    expect(mockNativeNavigate).not.toHaveBeenCalled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });

    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(windowStopSpy).toHaveBeenCalledTimes(1);
    expect(action).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Rechargez cette page pour reprendre.');
    const reload = screen.getByRole('button', { name: 'Recharger' });
    expect(mockNativeReload).not.toHaveBeenCalled();
    fireEvent.click(action, { button: 0, detail: 1 });
    expect(navigationAttempts.at(-1)).toEqual({ type: 'click', defaultPreventedBeforeTrap: true });
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    reload.focus();
    const reloadKeyboard = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await reloadKeyboard.keyboard(' '); // bouton de rechargement apres watchdog
    expect(mockNativeReload).toHaveBeenCalledTimes(1);
    mounted.unmount();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    jest.useRealTimers();
  });

  it('reste verrouillé avec récupération manuelle si la purge confirmée du handoff échoue', async () => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    const originalRemoveItem = Storage.prototype.removeItem;
    const removalFailure = jest.spyOn(Storage.prototype, 'removeItem')
      .mockImplementationOnce(function removeOnMount(this: Storage, key) {
        return originalRemoveItem.call(this, key);
      })
      .mockImplementationOnce(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    fireEvent.click(action, { button: 0, detail: 1 });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });

    expect(windowStopSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(action).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Rechargez cette page pour reprendre.');
    expect(mockNativeReload).not.toHaveBeenCalled();
    fireEvent.click(action, { button: 0, detail: 1 });
    expect(navigationAttempts.at(-1)).toEqual({ type: 'click', defaultPreventedBeforeTrap: true });
    fireEvent.click(screen.getByRole('button', { name: 'Recharger' }));
    expect(mockNativeReload).toHaveBeenCalledTimes(1);
    removalFailure.mockRestore();
  });

  it('annule une navigation restée sur la source, purge le handoff puis permet de restager le même élève', async () => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    const mounted = render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    fireEvent.click(action, { button: 0, detail: 1 });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });

    expect(windowStopSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(action).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByRole('alert')).toHaveTextContent('La navigation vers le simulateur a échoué. Réessayez.');

    fireEvent.click(action, { button: 0, detail: 1 });
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(navigationAttempts).toHaveLength(2);
    mounted.unmount();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
  });

  it('ne purge pas si pagehide gagne la course pendant la confirmation du watchdog', async () => {
    jest.useFakeTimers();
    windowStopSpy.mockImplementationOnce(() => {
      fireEvent(window, new PageTransitionEvent('pagehide'));
    });
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);

    fireEvent.click(await screen.findByRole('link', { name: 'Utiliser pour ce devis' }), { button: 0, detail: 1 });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });

    expect(windowStopSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(screen.queryByText('La navigation vers le simulateur a échoué. Réessayez.')).not.toBeInTheDocument();
  });

  it('conserve le handoff après pagehide et neutralise le watchdog', async () => {
    jest.useFakeTimers();
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    fireEvent.click(await screen.findByRole('link', { name: 'Utiliser pour ce devis' }), { button: 0, detail: 1 });
    fireEvent(window, new PageTransitionEvent('pagehide'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_STUDENT_NAVIGATION_WATCHDOG_MS + 1);
    });

    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toContain(directoryStudent.studentId);
    expect(windowStopSpy).not.toHaveBeenCalled();
    expect(screen.queryByText('La navigation vers le simulateur a échoué. Réessayez.')).not.toBeInTheDocument();
    jest.useRealTimers();
  });

  it('échoue fermé et reste réessayable si sessionStorage refuse le staging', async () => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      items: [directoryStudent],
    }), { status: 200 }));
    const storageFailure = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    render(<StudentsManagementWorkspace staffRole="ADMIN" intent="candidat-individuel" />);
    const action = await screen.findByRole('link', { name: 'Utiliser pour ce devis' });

    fireEvent.click(screen.getByRole('link', { name: 'Utiliser pour ce devis' }), { button: 0, detail: 1 });

    expect(mockNativeNavigate).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(CANDIDATE_STUDENT_HANDOFF_KEY)).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Cet élève ne peut pas être utilisé pour un devis. Réessayez.');
    expect(action).toBeEnabled();
    storageFailure.mockRestore();
  });

});
