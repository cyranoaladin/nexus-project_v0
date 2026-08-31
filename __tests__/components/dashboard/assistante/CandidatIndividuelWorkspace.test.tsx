import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

const mockRouterReplace = jest.fn();
let mockCandidateSearchParams = new URLSearchParams();

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard/assistante/candidat-individuel',
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockCandidateSearchParams,
}));

import { CandidatIndividuelWorkspace } from '@/components/dashboard/assistante/CandidatIndividuelWorkspace';
import { DUPLICATE_LANGUAGE_MESSAGE } from '@/lib/exams/languages';
import { stageCandidateStudentHandoff } from '@/lib/quotes/candidat-individuel-navigation';
import type { CandidatIndividuelStudentSearchItem } from '@/lib/quotes/candidat-individuel-search-contracts';
import { CANDIDATE_IDENTITY_TIMEOUT_MS } from '@/lib/quotes/candidat-individuel-identity.client';

const lead = {
  id: 'lead-0001',
  name: 'Sonia Ben Salah',
  email: 'sonia@example.test',
  phone: '+21699111222',
  status: 'NEW',
};

const student = {
  id: 'student-1',
  studentId: 'student-1',
  userId: 'student-user-1',
  user: { firstName: 'Yasmine', lastName: 'Ben Salah', email: 'yasmine@example.test', mergedIntoUserId: null },
  responsible: {
    parentProfileId: 'parent-profile-1', userId: 'parent-user-1', firstName: 'Sonia', lastName: 'Ben Salah',
    email: 'sonia@example.test', mergedIntoUserId: null,
  },
};

const explicitStudent = {
  id: 'student-1',
  studentId: 'student-1',
  userId: 'student-user-1',
  user: { firstName: 'Yasmine', lastName: 'Ben Salah', email: 'yasmine@example.test', mergedIntoUserId: null },
  responsible: {
    parentProfileId: 'parent-profile-1',
    userId: 'parent-user-1',
    firstName: 'Sonia',
    lastName: 'Ben Salah',
    email: 'sonia@example.test',
    mergedIntoUserId: null,
  },
};

const leadSearchItem = {
  contactLeadId: lead.id,
  displayName: lead.name,
  email: lead.email,
};

function selectableStudentSearchItem(candidate: typeof explicitStudent & { grade?: string | null; school?: string | null }): CandidatIndividuelStudentSearchItem {
  return {
    studentId: candidate.studentId,
    displayName: [candidate.user.firstName, candidate.user.lastName].filter(Boolean).join(' '),
    email: candidate.user.email,
    grade: candidate.grade ?? null,
    school: candidate.school ?? null,
    selectable: true,
    unavailableReason: null,
  };
}

const unavailableStudentSearchItems = [
  { studentId: 'student-unavailable-1', displayName: 'Élève fusionné', email: 'student1@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Compte élève fusionné' },
  { studentId: 'student-unavailable-2', displayName: 'Élève sans responsable', email: 'student2@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Responsable absent' },
  { studentId: 'student-unavailable-3', displayName: 'Élève responsable fusionné', email: 'student3@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Compte responsable fusionné' },
  { studentId: 'student-unavailable-4', displayName: 'Élève sans email responsable', email: 'student4@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Adresse email du responsable manquante' },
  { studentId: 'student-unavailable-5', displayName: 'Élève sans nom responsable', email: 'student5@example.test', grade: 'Terminale', school: 'Lycée test', selectable: false, unavailableReason: 'Nom du responsable manquant' },
] satisfies CandidatIndividuelStudentSearchItem[];

const readyResult = {
  status: 'READY',
  diagnosticStatus: 'ABSENT',
  budgetInsuffisantPourSocle: false,
  modulesNonRepresentables: [],
  validation: { emissionAutomatiqueAutorisee: true, necessiteVerificationHumaine: false },
  carte: { parcours: { labelFamille: 'Candidat individuel - parcours sur deux ans' } },
  selection: {},
  scenarios: [
    {
      tier: 'RECOMMANDE',
      lines: [
        {
          subject: 'eds1',
          label: 'Mathématiques',
          modality: 'GROUPE',
          hoursPerMonth: 4,
          unitPriceMonthly: 250,
          priorityScore: 100,
          priorityLabel: 'haute',
          reason: 'Accompagnement recommandé',
        },
        {
          subject: 'pilotage',
          label: 'Pilotage Nexus',
          modality: 'PILOTAGE',
          hoursPerMonth: null,
          unitPriceMonthly: 150,
          priorityScore: 100,
          priorityLabel: 'haute',
          reason: 'Suivi du parcours',
        },
      ],
      notRecommended: [],
      monthlyTotal: 300,
      grandTotal: 4000,
      months: 10,
      matchedOfferId: null,
      paymentPolicy: 'ANNUAL_DEPOSIT_25_THEN_10_INSTALLMENTS',
      deposit: 1000,
      lastInstallmentAmount: 300,
    },
  ],
};

const staffQuote = {
  id: 'quote-1',
  statusLabel: 'Brouillon interne',
  updatedAt: '2026-08-29T10:00:00.000Z',
  totals: {
    annualTnd: 9600,
    depositTnd: 2400,
    installmentTnd: 720,
    installmentCount: 10,
  },
  lines: [
    { subject: 'Mathématiques', modality: 'Individuel', hoursPerMonth: 4, monthlyAmountTnd: 720 },
    { subject: 'Pilotage Nexus', modality: 'Pilotage Nexus', hoursPerMonth: null, monthlyAmountTnd: 150 },
  ],
  margin: { percentage: 45, statusLabel: 'Marge conforme' },
  actions: {
    canPublish: true,
    canIssueFamilyLink: false,
    canRotateFamilyLink: false,
    canDownloadPdf: true,
    canCreateRevision: true,
    hasFamilyLink: false,
  },
};

type MockResponse = { ok?: boolean; status?: number; body: unknown };

function jsonResponse(response: MockResponse): Response {
  return {
    ok: response.ok ?? true,
    status: response.status ?? (response.ok === false ? 422 : 200),
    json: async () => response.body,
  } as Response;
}

function installFetchRouter(overrides: {
  simulate?: MockResponse;
  quote?: MockResponse | Array<MockResponse | Error>;
  publish?: MockResponse;
  family?: MockResponse;
  profiles?: unknown[];
  profile?: unknown;
  profilesById?: Record<string, unknown>;
  revision?: MockResponse;
  reconcile?: MockResponse;
  identityResolution?: MockResponse;
  profileIds?: string[];
  students?: unknown[];
  studentSearchItems?: CandidatIndividuelStudentSearchItem[];
} = {}) {
  let quoteCallCount = 0;
  let profileCreateCount = 0;
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url === '/api/assistante/candidat-individuel/profils' && method === 'GET') {
      return jsonResponse({ body: { profils: overrides.profiles ?? [] } });
    }
    if (url === '/api/assistante/candidat-individuel/leads/search' && method === 'POST') {
      return jsonResponse({ body: { items: [leadSearchItem] } });
    }
    if (url === '/api/assistante/candidat-individuel/students/search' && method === 'POST') {
      const candidates = (overrides.students ?? [student]) as Array<typeof explicitStudent>;
      const items = overrides.studentSearchItems ?? candidates.map(selectableStudentSearchItem);
      return jsonResponse({
        body: {
          items,
          pagination: { page: 1, limit: 10, total: items.length, totalPages: items.length > 0 ? 1 : 0 },
        },
      });
    }
    if (url === '/api/assistante/candidat-individuel/identity/resolve' && method === 'POST') {
      if (overrides.identityResolution) return jsonResponse(overrides.identityResolution);
      const body = JSON.parse(String(init?.body ?? '{}')) as { studentId?: string };
      const candidates = (overrides.students ?? [student]) as Array<typeof explicitStudent>;
      const resolvedStudent = candidates.find((candidate) => candidate.studentId === body.studentId) ?? explicitStudent;
      const responsible = resolvedStudent.responsible;
      return jsonResponse({
        body: {
          success: true,
          contactLead: {
            ...lead,
            id: `lead-${responsible.userId}`,
            name: [responsible.firstName, responsible.lastName].filter(Boolean).join(' '),
            email: responsible.email,
          },
          student: resolvedStudent,
        },
      });
    }
    if (url === '/api/assistante/candidat-individuel/profils' && method === 'POST') {
      const ids = overrides.profileIds ?? ['profil-1'];
      const id = ids[Math.min(profileCreateCount++, ids.length - 1)];
      return jsonResponse({ body: { profil: { id } }, status: 201 });
    }
    const profileMatch = url.match(/\/api\/assistante\/candidat-individuel\/profils\/(profil-[^/]+)$/);
    if (profileMatch && method === 'GET') {
      return jsonResponse({ body: { profil: overrides.profilesById?.[profileMatch[1]] ?? overrides.profile } });
    }
    if (url === '/api/assistante/candidat-individuel/profils/profil-1/revision' && method === 'POST') {
      return jsonResponse(overrides.revision ?? { body: { profil: overrides.profile }, status: 201 });
    }
    if (url === '/api/assistante/candidat-individuel/simulate') {
      return jsonResponse(overrides.simulate ?? { body: { result: readyResult } });
    }
    if (/\/profils\/profil-[^/]+\/quote\/reconcile$/.test(url) && method === 'POST') {
      return jsonResponse(overrides.reconcile ?? { ok: false, status: 404, body: { error: 'Aucun devis ne correspond à cette tentative.' } });
    }
    if (/\/profils\/profil-[^/]+\/quote$/.test(url)) {
      const configured = Array.isArray(overrides.quote)
        ? overrides.quote[Math.min(quoteCallCount++, overrides.quote.length - 1)]
        : overrides.quote;
      if (configured instanceof Error) throw configured;
      return jsonResponse(configured ?? { body: { quote: staffQuote }, status: 201 });
    }
    if (url.endsWith('/quotes/quote-1/publish')) {
      return jsonResponse(overrides.publish ?? {
        body: {
          quote: {
            ...staffQuote,
            statusLabel: 'Validé pour la famille',
            actions: { ...staffQuote.actions, canPublish: false, canIssueFamilyLink: true },
          },
        },
      });
    }
    if (url.endsWith('/quotes/quote-1/family-link')) {
      return jsonResponse(overrides.family ?? {
        body: { familyUrl: 'https://example.test/devis/raw-session-token', action: 'LINK_ISSUED' },
      });
    }
    throw new Error(`Unexpected fetch: ${method} ${url}`);
  }) as typeof fetch;
}

async function selectIdentity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Rechercher un responsable'), 'sonia');
  await user.click(await screen.findByRole('option', { name: /sonia ben salah/i }));
  await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
  await user.click(await screen.findByRole('option', { name: /yasmine ben salah/i }));
}

async function reachModules(user: ReturnType<typeof userEvent.setup>) {
  await selectIdentity(user);
  await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
  await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));
  await screen.findByRole('heading', { name: 'Besoins et accompagnements' });
}

describe('CandidatIndividuelWorkspace', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    mockCandidateSearchParams = new URLSearchParams();
    mockRouterReplace.mockReset();
    window.sessionStorage.clear();
  });

  test('consomme le handoff same-tab, applique l’identité autoritative et ne touche pas à l’URL', async () => {
    const contextualId = 'cm1studentopaqueidentifier01';
    const contextualStudent = { ...explicitStudent, id: contextualId, studentId: contextualId };
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter({ students: [contextualStudent] });
    const user = userEvent.setup();

    render(<CandidatIndividuelWorkspace />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      '/api/assistante/candidat-individuel/identity/resolve',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ studentId: contextualId }) }),
    ));
    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    expect(screen.getByTestId('selected-lead')).toHaveTextContent('Sonia Ben Salah');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
    expect(screen.getByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
  });

  test('rejette un handoff contextuel invalide, explique le blocage et le supprime', async () => {
    window.sessionStorage.setItem('nexus:candidat-individuel:selected-student', 'https://evil.example');
    installFetchRouter();

    render(<CandidatIndividuelWorkspace />);

    expect(await screen.findByRole('alert')).toHaveTextContent('La sélection de l’élève est invalide. Recherchez à nouveau cet élève.');
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(0);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('reste utilisable et humanise un refus d’accès au sessionStorage', async () => {
    installFetchRouter();
    const descriptor = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => { throw new DOMException('denied', 'SecurityError'); },
    });
    try {
      render(<CandidatIndividuelWorkspace staffRole="ADMIN" />);
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'La sélection de l’élève est invalide. Recherchez à nouveau cet élève.',
      );
      expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
    } finally {
      if (descriptor) Object.defineProperty(window, 'sessionStorage', descriptor);
    }
  });

  test('sort du chargement après timeout puis réussit au retry sans rester bloqué', async () => {
    jest.useFakeTimers();
    const contextualId = 'cm1studentopaqueidentifier01';
    const contextualStudent = { ...explicitStudent, id: contextualId, studentId: contextualId };
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter({ students: [contextualStudent] });
    const routedFetch = global.fetch as jest.Mock;
    let resolutionAttempt = 0;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve' && resolutionAttempt++ === 0) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return routedFetch(input, init);
    }) as typeof fetch;

    render(<CandidatIndividuelWorkspace />);
    await act(async () => { await jest.advanceTimersByTimeAsync(10_001); });

    expect(await screen.findByRole('alert')).toHaveTextContent('Le rattachement prend trop de temps. Réessayez.');
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await act(async () => { await Promise.resolve(); });

    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
  });

  test('nettoie le contexte et humanise une erreur réseau sans exposer de code interne', async () => {
    const contextualId = 'cm1studentopaqueidentifier01';
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      return routedFetch(input, init);
    }) as typeof fetch;

    render(<CandidatIndividuelWorkspace />);

    expect(await screen.findByRole('alert')).toHaveTextContent('La connexion au service de rattachement a échoué. Vérifiez le réseau puis réessayez.');
    expect(screen.getByRole('alert')).not.toHaveTextContent('NETWORK');
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
  });

  test('abandonne la résolution contextuelle au démontage sans appliquer de réponse tardive', async () => {
    const contextualId = 'cm1studentopaqueidentifier01';
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    let resolutionSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve') {
        resolutionSignal = init?.signal ?? undefined;
        return new Promise<Response>(() => undefined);
      }
      return routedFetch(input, init);
    }) as typeof fetch;

    const view = render(<CandidatIndividuelWorkspace />);
    await waitFor(() => expect(resolutionSignal).toBeDefined());
    view.unmount();

    expect(resolutionSignal?.aborted).toBe(true);
  });

  test('annule une résolution consommée sous un autre rôle lors du changement de session', async () => {
    const contextualId = 'cm1studentopaqueidentifier01';
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    let resolutionSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve') {
        resolutionSignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          resolutionSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return routedFetch(input, init);
    }) as typeof fetch;

    const view = render(<CandidatIndividuelWorkspace staffRole="ASSISTANTE" />);
    await waitFor(() => expect(resolutionSignal).toBeDefined());
    view.rerender(<CandidatIndividuelWorkspace staffRole="ADMIN" />);

    expect(resolutionSignal?.aborted).toBe(true);
    expect(window.sessionStorage.getItem('nexus:candidat-individuel:selected-student')).toBeNull();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('ne résout le handoff qu’une fois après consommation, y compris après un nouveau montage', async () => {
    const contextualId = 'cm1studentopaqueidentifier01';
    const contextualStudent = { ...explicitStudent, id: contextualId, studentId: contextualId };
    stageCandidateStudentHandoff(window.sessionStorage, 'ASSISTANTE', contextualId);
    installFetchRouter({ students: [contextualStudent] });

    const first = render(<CandidatIndividuelWorkspace />);
    await screen.findByTestId('selected-student');
    first.unmount();
    const resolutionCount = (global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve').length;
    render(<CandidatIndividuelWorkspace />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/profils'));
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(resolutionCount);
  });

  test('présente un assistant progressif, accessible et sans identifiants techniques', async () => {
    installFetchRouter();
    render(<CandidatIndividuelWorkspace />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/profils'));

    expect(screen.getByRole('navigation', { name: 'Étapes du simulateur' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Élève et responsable' })).toBeInTheDocument();
    expect(screen.getByLabelText('Rechercher un responsable')).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.getByLabelText('Rechercher un élève')).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.queryByText(/identifiant manuellement/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/MOD_|P\d+_/)).not.toBeInTheDocument();

    const advanced = screen.getByText('Options avancées').closest('details');
    expect(advanced).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('recherche puis sélectionne le responsable et l’élève sans demander leurs IDs', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);

    expect(screen.getAllByText(/sonia ben salah/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/yasmine ben salah/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
    expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/leads/search', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'sonia', limit: 10 }),
      signal: expect.anything(),
    }));
    expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'yasmine', page: 1, limit: 10 }),
      signal: expect.anything(),
    }));
    expect((global.fetch as jest.Mock).mock.calls.map(([url]) => String(url)).join('\n')).not.toMatch(/[?&](?:q|query|search)=/);
  });

  test('rejette fail-closed un ancien payload responsable id/name/phone', async () => {
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (
        String(input) === '/api/assistante/candidat-individuel/leads/search'
        && init?.method === 'POST'
      ) {
        return Promise.resolve(jsonResponse({
          body: {
            items: [{
              id: 'legacy-lead-001',
              name: 'Ancien Responsable',
              email: 'legacy@example.test',
              phone: '+216 99 111 222',
            }],
          },
        }));
      }
      return routedFetch(input, init);
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.type(screen.getByLabelText('Rechercher un responsable'), 'legacy');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La recherche des responsables a échoué.',
    );
    expect(screen.queryByRole('option', { name: /Ancien Responsable/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/assistante/candidat-individuel/leads/search',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ query: 'legacy', limit: 10 }),
      }),
    );
    expect(
      (global.fetch as jest.Mock).mock.calls.map(([url]) => String(url)).join('\n'),
    ).not.toMatch(/[?&](?:q|query|search)=/);
  });

  test('résout le responsable depuis le vrai Student.id puis active le passage au profil', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    const studentSearch = screen.getByLabelText('Rechercher un élève');
    expect(studentSearch).toBeEnabled();
    await user.type(studentSearch, 'yasmine');
    await user.click(await screen.findByRole('option', { name: /yasmine ben salah/i }));

    const resolutionCall = await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
        url === '/api/assistante/candidat-individuel/identity/resolve' && init?.method === 'POST');
      expect(call).toBeDefined();
      return call;
    });
    const resolutionBody = JSON.parse(resolutionCall[1].body);
    expect(resolutionBody).toEqual({ studentId: 'student-1' });
    expect(resolutionBody.studentId).not.toBe('student-user-1');

    expect(screen.getByTestId('selected-lead')).toHaveTextContent('Sonia Ben Salah');
    expect(screen.getByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    const continueButton = screen.getByRole('button', { name: 'Continuer vers le profil' });
    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(screen.getByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
  });

  test('engage la sélection souris avant la perte de focus sans doubler le POST au click', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    const option = await screen.findByRole('option', { name: /yasmine ben salah/i });
    fireEvent.mouseDown(option, { button: 0 });
    fireEvent.click(option, { detail: 1 });

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([url, init]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve'
      && init?.method === 'POST'
      && init?.body === JSON.stringify({ studentId: 'student-1' }))).toHaveLength(1));
    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
  });

  test('ne sélectionne pas un élève quand un geste tactile de scroll est annulé', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    const option = await screen.findByRole('option', { name: /yasmine ben salah/i });
    fireEvent.pointerDown(option, { pointerType: 'touch', button: 0 });
    fireEvent.pointerCancel(option, { pointerType: 'touch' });

    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('sélectionne au click tactile avec exactement un POST', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    const option = await screen.findByRole('option', { name: /yasmine ben salah/i });
    fireEvent.click(option, { detail: 1 });

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(1));
    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
  });

  test.each([
    ['Entrée', '{Enter}'],
    ['Espace', ' '],
  ])('sélectionne au clavier avec %s et exactement un POST', async (_keyName, key) => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    const option = await screen.findByRole('option', { name: /yasmine ben salah/i });
    option.focus();
    await user.keyboard(key);

    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(1));
    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
  });

  test('affiche le timeout humain, libère le verrou puis réussit au retry', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const routedFetch = global.fetch as jest.Mock;
    let identityAttempt = 0;
    let firstSignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve') {
        identityAttempt += 1;
        if (identityAttempt === 1) {
          firstSignal = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            firstSignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
          });
        }
      }
      return routedFetch(input, init);
    }) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    const option = await screen.findByRole('option', { name: /yasmine ben salah/i });

    jest.useFakeTimers();
    fireEvent.click(option, { detail: 1 });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CANDIDATE_IDENTITY_TIMEOUT_MS + 1);
    });
    expect(firstSignal?.aborted).toBe(true);
    expect(screen.getByRole('alert')).toHaveTextContent('Le rattachement prend trop de temps. Réessayez.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeEnabled();

    jest.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    expect(identityAttempt).toBe(2);
  });

  test('aborte une résolution en cours au démontage sans conserver de verrou', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const routedFetch = global.fetch as jest.Mock;
    let identitySignal: AbortSignal | undefined;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === '/api/assistante/candidat-individuel/identity/resolve') {
        identitySignal = init?.signal ?? undefined;
        return new Promise<Response>((_resolve, reject) => {
          identitySignal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return routedFetch(input, init);
    }) as typeof fetch;
    const user = userEvent.setup();
    const { unmount } = render(<CandidatIndividuelWorkspace />);
    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    fireEvent.click(await screen.findByRole('option', { name: /yasmine ben salah/i }), { detail: 1 });
    await waitFor(() => expect(identitySignal).toBeDefined());

    unmount();

    expect(identitySignal?.aborted).toBe(true);
  });

  test('ne confond jamais le texte saisi avec une sélection métier', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    const studentSearch = screen.getByLabelText('Rechercher un élève');
    expect(studentSearch).toBeEnabled();
    await user.type(screen.getByLabelText('Rechercher un responsable'), 'sonia');
    expect(await screen.findByRole('option', { name: /sonia ben salah/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
    expect(studentSearch).toBeEnabled();

    await user.click(screen.getByRole('option', { name: /sonia ben salah/i }));
    expect(studentSearch).toBeEnabled();
  });

  test('désélectionne et remplace l’élève sans conserver un studentId obsolète', async () => {
    const replacement = {
      ...explicitStudent, studentId: 'student-2', userId: 'student-user-2',
      user: { firstName: 'Amine', lastName: 'Ben Salah', email: 'amine@example.test', mergedIntoUserId: null },
    };
    installFetchRouter({ students: [explicitStudent, replacement] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await selectIdentity(user);

    await user.click(screen.getByRole('button', { name: "Changer d'élève" }));
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
    await user.type(screen.getByLabelText('Rechercher un élève'), 'amine');
    await user.click(await screen.findByRole('option', { name: /amine ben salah/i }));
    expect(screen.getByTestId('selected-student')).toHaveTextContent('Amine Ben Salah');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));
    const profileCall = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
      url === '/api/assistante/candidat-individuel/profils' && init?.method === 'POST');
    expect(JSON.parse(profileCall[1].body)).toMatchObject({ studentId: 'student-2' });
  });

  test('changer de responsable invalide immédiatement l’élève sélectionné', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await selectIdentity(user);

    await user.click(screen.getByRole('button', { name: 'Changer de responsable' }));

    expect(screen.queryByTestId('selected-lead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selected-student')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('ignore une résolution élève tardive après la création d’un nouveau dossier', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const routedFetch = global.fetch as jest.Mock;
    let resolveIdentity!: (response: Response) => void;
    const pendingIdentity = new Promise<Response>((resolve) => { resolveIdentity = resolve; });
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      String(input) === '/api/assistante/candidat-individuel/identity/resolve' && init?.method === 'POST'
        ? pendingIdentity
        : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'yasmine');
    await user.click(await screen.findByRole('option', { name: /yasmine ben salah/i }));
    expect(await screen.findByText('Rattachement du responsable en cours...')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Nouveau' }));
    await act(async () => {
      resolveIdentity(jsonResponse({
        body: { success: true, contactLead: lead, student: explicitStudent },
      }));
    });

    expect(screen.queryByTestId('selected-lead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('selected-student')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test('persiste le Student.id explicite après le clic élève puis ouvre le profil', async () => {
    installFetchRouter({ students: [explicitStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);
    expect(screen.getByTestId('selected-student')).toHaveTextContent('Yasmine Ben Salah');
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
    expect(screen.getByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));

    const profileCall = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
      url === '/api/assistante/candidat-individuel/profils' && init?.method === 'POST');
    expect(JSON.parse(profileCall[1].body)).toMatchObject({
      contactLeadId: 'lead-0001',
      studentId: 'student-1',
    });
  });

  test('bloque humainement un élève rattaché à un autre responsable', async () => {
    installFetchRouter({ students: [{
      ...explicitStudent,
      studentId: 'student-other-family',
      responsible: { ...explicitStudent.responsible, email: 'other-parent@example.test' },
    }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);

    expect(screen.getByRole('alert')).toHaveTextContent(/rattaché à un autre responsable/i);
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test.each(unavailableStudentSearchItems)(
    'garde focusable mais inerte un dossier indisponible: $unavailableReason',
    async (unavailableStudent) => {
    installFetchRouter({ studentSearchItems: [unavailableStudent] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.type(screen.getByLabelText('Rechercher un élève'), 'élève');

    const unavailable = await screen.findByText(unavailableStudent.unavailableReason);
    const option = screen.getByRole('option', { name: new RegExp(unavailableStudent.displayName, 'i') });
    expect(option).not.toBeDisabled();
    expect(option).toHaveAttribute('aria-disabled', 'true');
    expect(option).toHaveAttribute('aria-describedby', unavailable.id);
    option.focus();
    expect(option).toHaveFocus();
    await user.click(option);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) =>
      url === '/api/assistante/candidat-individuel/identity/resolve')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Continuer vers le profil' })).toBeDisabled();
  });

  test.each([
    ['responsable', 'Rechercher un responsable', '/api/assistante/candidat-individuel/leads/search'],
    ['élève', 'Rechercher un élève', '/api/assistante/candidat-individuel/students/search'],
  ] as const)('annule la recherche %s précédente au changement de requête puis au démontage', async (_kind, label, endpoint) => {
    installFetchRouter();
    const { unmount } = render(<CandidatIndividuelWorkspace />);
    const input = screen.getByLabelText(label);

    fireEvent.change(input, { target: { value: 'première' } });
    const firstCall = await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
        url === endpoint && init?.body?.toString().includes('première'));
      expect(call).toBeDefined();
      return call;
    });
    const firstSignal = firstCall[1].signal as AbortSignal;
    expect(firstSignal.aborted).toBe(false);

    fireEvent.change(input, { target: { value: 'seconde' } });
    expect(firstSignal.aborted).toBe(true);
    const secondCall = await waitFor(() => {
      const call = (global.fetch as jest.Mock).mock.calls.find(([url, init]) =>
        url === endpoint && init?.body?.toString().includes('seconde'));
      expect(call).toBeDefined();
      return call;
    });
    const secondSignal = secondCall[1].signal as AbortSignal;
    expect(secondSignal.aborted).toBe(false);

    unmount();
    expect(secondSignal.aborted).toBe(true);
  });

  test('ignore une ancienne réponse responsable libérée après la requête courante', async () => {
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    let resolveOld!: (response: Response) => void;
    let resolveCurrent!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const currentResponse = new Promise<Response>((resolve) => { resolveCurrent = resolve; });
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/assistante/candidat-individuel/leads/search' && JSON.parse(String(init?.body ?? '{}')).query === 'sonia') return oldResponse;
      if (url === '/api/assistante/candidat-individuel/leads/search' && JSON.parse(String(init?.body ?? '{}')).query === 'amine') return currentResponse;
      return routedFetch(input, init);
    }) as typeof fetch;
    render(<CandidatIndividuelWorkspace />);
    const search = screen.getByLabelText('Rechercher un responsable');

    fireEvent.change(search, { target: { value: 'sonia' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/leads/search', expect.objectContaining({ body: JSON.stringify({ query: 'sonia', limit: 10 }), signal: expect.anything() })));
    fireEvent.change(search, { target: { value: 'amine' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/leads/search', expect.objectContaining({ body: JSON.stringify({ query: 'amine', limit: 10 }), signal: expect.anything() })));
    await act(async () => { resolveCurrent(jsonResponse({ body: { items: [{ ...leadSearchItem, contactLeadId: 'lead-current', displayName: 'Amine Trabelsi', email: 'amine@example.test' }] } })); });
    expect(await screen.findByRole('option', { name: /amine trabelsi/i })).toBeInTheDocument();
    await act(async () => { resolveOld(jsonResponse({ body: { items: [leadSearchItem] } })); });

    expect(screen.queryByRole('option', { name: /sonia ben salah/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /amine trabelsi/i })).toBeInTheDocument();
  });

  test('ignore une ancienne réponse élève libérée après la requête courante', async () => {
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    let resolveOld!: (response: Response) => void;
    let resolveCurrent!: (response: Response) => void;
    const oldResponse = new Promise<Response>((resolve) => { resolveOld = resolve; });
    const currentResponse = new Promise<Response>((resolve) => { resolveCurrent = resolve; });
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/assistante/candidat-individuel/students/search' && JSON.parse(String(init?.body ?? '{}')).query === 'yasmine') return oldResponse;
      if (url === '/api/assistante/candidat-individuel/students/search' && JSON.parse(String(init?.body ?? '{}')).query === 'amine') return currentResponse;
      return routedFetch(input, init);
    }) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.type(screen.getByLabelText('Rechercher un responsable'), 'sonia');
    await user.click(await screen.findByRole('option', { name: /sonia ben salah/i }));
    const search = screen.getByLabelText('Rechercher un élève');

    fireEvent.change(search, { target: { value: 'yasmine' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({ body: JSON.stringify({ query: 'yasmine', page: 1, limit: 10 }), signal: expect.anything() })));
    fireEvent.change(search, { target: { value: 'amine' } });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/assistante/candidat-individuel/students/search', expect.objectContaining({ body: JSON.stringify({ query: 'amine', page: 1, limit: 10 }), signal: expect.anything() })));
    const currentStudent = { ...explicitStudent, studentId: 'student-current', userId: 'student-user-current', user: { ...explicitStudent.user, firstName: 'Amine', lastName: 'Trabelsi' } };
    await act(async () => { resolveCurrent(jsonResponse({ body: { items: [selectableStudentSearchItem(currentStudent)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } })); });
    expect(await screen.findByRole('option', { name: /amine trabelsi/i })).toBeInTheDocument();
    await act(async () => { resolveOld(jsonResponse({ body: { items: [selectableStudentSearchItem(explicitStudent)], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } } })); });

    expect(screen.queryByRole('option', { name: /yasmine ben salah/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /amine trabelsi/i })).toBeInTheDocument();
  });

  test('lie les contrôles Individuel/Duo/Petit groupe au confirmedHeadcount sans inventer 3', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    expect(within(mathsCard).getByText('4 h / mois')).toBeInTheDocument();
    expect(within(mathsCard).getByText('250 TND / mois')).toBeInTheDocument();
    expect(within(mathsCard).getByRole('button', { name: 'Individuel' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(mathsCard).getByRole('button', { name: 'Duo' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(mathsCard).getByRole('button', { name: 'Petit groupe' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(/groupe de mathématiques n'est pas encore confirmé/i)).toBeInTheDocument();

    await user.click(within(mathsCard).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    expect(screen.getByText('À recalculer par le serveur')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect((await screen.findAllByText('9 600 TND')).length).toBeGreaterThan(0);
    const quoteCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    const quoteBody = JSON.parse(quoteCall[1].body);
    expect(quoteBody.confirmedHeadcountBySubject).toEqual({ eds1: 1 });
  });

  test('humanise les blocages serveur sans exposer les codes internes', async () => {
    installFetchRouter({
      simulate: {
        body: {
          result: {
            status: 'DIRECTION_APPROVAL_REQUIRED',
            pendingModuleIds: ['MOD_DGEMC'],
            pendingServiceIds: [],
          },
        },
      },
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await selectIdentity(user);
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));

    expect(await screen.findByText("Cette option n'est pas disponible dans l'offre V1.")).toBeInTheDocument();
    expect(screen.queryByText('MOD_DGEMC')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Générer le devis' })).not.toBeInTheDocument();
  });

  test('n’affiche publication, lien famille et PDF que lorsque chaque action est possible', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    const clipboardWrite = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Télécharger le PDF' })).toHaveAttribute(
      'href',
      '/api/assistante/candidat-individuel/quotes/quote-1/pdf',
    );
    expect(screen.getByText('Marge conforme')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Valider et publier' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Créer le lien famille' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Valider et publier' }));
    await user.click(await screen.findByRole('button', { name: 'Créer le lien famille' }));
    expect(await screen.findByLabelText('Lien famille sécurisé')).toHaveValue('https://example.test/devis/raw-session-token');
    expect(screen.queryByText(/marginPct|costPolicy|snapshotRegles/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Copier le lien' }));
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith('https://example.test/devis/raw-session-token'));
  });

  test('invalide immédiatement le devis si l’effectif exact est modifié ou effacé', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Petit groupe' }));
    await user.type(within(mathsCard).getByLabelText("Nombre exact d'élèves confirmés"), '3');
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Besoins' }));
    const exactSize = screen.getByLabelText("Nombre exact d'élèves confirmés");
    await user.clear(exactSize);
    await user.type(exactSize, '4');

    expect(screen.queryByRole('button', { name: 'Valider et publier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Télécharger le PDF' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Besoins et accompagnements' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5 Devis' })).toBeDisabled();
  });

  test('utilise les lignes persistées et repricées du DTO staff dans la synthèse', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);

    const mathsCard = screen.getByRole('article', { name: 'Mathématiques' });
    await user.click(within(mathsCard).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const summary = await screen.findByRole('region', { name: 'Lignes du devis serveur' });
    expect(within(summary).getByText('Individuel')).toBeInTheDocument();
    expect(within(summary).getByText('720 TND / mois')).toBeInTheDocument();
    expect(within(summary).queryByText('Petit groupe')).not.toBeInTheDocument();
    expect(within(summary).queryByText('250 TND / mois')).not.toBeInTheDocument();
  });

  test('demande un motif pour une marge à revoir et ne propose jamais d’override bloqué', async () => {
    installFetchRouter({
      quote: [
        {
          ok: false,
          status: 422,
          body: {
            error: 'Validation explicite requise',
            marginReview: { percentage: 35, statusLabel: 'Validation de la marge requise', canOverride: true },
          },
        },
        { body: { quote: { ...staffQuote, margin: { percentage: 35, statusLabel: 'Marge validée par le staff' } } }, status: 201 },
      ],
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByText('35 %')).toBeInTheDocument();
    const reason = screen.getByLabelText('Motif de validation de la marge');
    expect(screen.getByRole('button', { name: 'Valider la marge et générer' })).toBeDisabled();
    await user.type(reason, 'Validation commerciale par la direction');
    await user.click(screen.getByRole('button', { name: 'Valider la marge et générer' }));

    await screen.findByRole('heading', { name: 'Synthèse du devis' });
    const quoteCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    expect(JSON.parse(quoteCalls[1][1].body).marginOverride).toEqual({ reason: 'Validation commerciale par la direction' });

  });

  test('ne propose aucun contournement quand la marge est bloquée', async () => {
    installFetchRouter({
      quote: {
        ok: false,
        status: 422,
        body: { error: 'Proposition bloquée', marginReview: { percentage: 22, statusLabel: 'Proposition bloquée', canOverride: false } },
      },
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByText('22 %')).toBeInTheDocument();
    expect(screen.getByText(/ne peut pas être validée/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Motif de validation de la marge')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Valider la marge et générer' })).not.toBeInTheDocument();
  });

  test('contraint les spécialités, les langues et construit les dispenses depuis des contrôles dédiés', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await selectIdentity(user);
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));

    const specialty = screen.getByLabelText('Première spécialité poursuivie');
    expect(within(specialty).queryByRole('option', { name: 'Français' })).not.toBeInTheDocument();
    expect(within(specialty).queryByRole('option', { name: /maths expertes/i })).not.toBeInTheDocument();
    const language = screen.getByLabelText('Langue vivante A', { selector: 'select' });
    expect(within(language).getAllByRole('option')).toHaveLength(7);
    expect(within(language).queryByRole('option', { name: 'Mathématiques' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('Dispense - Philosophie')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Dispense - Philosophie'));
    await user.selectOptions(screen.getByLabelText('Statut de la dispense - Philosophie'), 'CONFIRMEE');
    await user.type(screen.getByLabelText('Référence du justificatif - Philosophie'), 'doc-verifie-1');
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));

    const simulateCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => url === '/api/assistante/candidat-individuel/simulate');
    const payload = JSON.parse(simulateCall[1].body);
    expect(payload.staffExtension.dispensesDeclarees).toEqual([
      { epreuveId: 'philosophie', statut: 'CONFIRMEE', justificatifRef: 'doc-verifie-1' },
    ]);
  });

  test('reprend le dernier devis curaté sans dupliquer ni prétendre retrouver le lien brut', async () => {
    const profile = {
      id: 'profil-1',
      level: 'TERMINALE',
      examSession: 2027,
      modalite: 'A',
      specialite1: 'MATHEMATIQUES',
      specialite2: 'NSI',
      specialiteAbandonnee: null,
      langueA: 'ANGLAIS',
      langueB: 'ESPAGNOL',
      optionsTerminale: [],
      estRedoublant: false,
      estTitulaireBacDejaObtenu: false,
      changementSpecialite: false,
      intentionAmelioration: false,
      intentionCycleComplet: true,
      moyenneRattrapage: null,
      etalementPlurisessionsDeclare: false,
      brancheBascule: null,
      contactLead: lead,
      student,
      lastQuote: {
        ...staffQuote,
        statusLabel: 'Validé pour la famille',
        actions: { ...staffQuote.actions, canPublish: false, canIssueFamilyLink: true, canRotateFamilyLink: true, hasFamilyLink: true },
      },
    };
    installFetchRouter({ profiles: [profile], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);

    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    expect(screen.getAllByRole('region', { name: 'Lignes du devis serveur' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Renouveler le lien famille' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Lien famille sécurisé')).not.toBeInTheDocument();
    expect(screen.getByText(/le lien existant n'est pas réaffichable/i)).toBeInTheDocument();
  });

  test('réutilise la même clé idempotente après un échec réseau puis la renouvelle après succès et changement commercial', async () => {
    installFetchRouter({ quote: [new Error('network'), { body: { quote: staffQuote }, status: 201 }, { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    expect(await screen.findByText(/résultat de la création est inconnu/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Besoins' }));
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const quoteCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).endsWith('/profils/profil-1/quote'));
    const keys = quoteCalls.map(([, init]) => JSON.parse(init.body).idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(quoteCalls[0][1].body).toBe(quoteCalls[1][1].body);
    expect(keys[2]).not.toBe(keys[1]);
  });

  test('ne propose pas un second POST après succès tant que le profil et le fingerprint sont inchangés', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('heading', { name: 'Synthèse du devis' });

    await user.click(screen.getByRole('button', { name: 'Financement' }));
    expect(screen.queryByRole('button', { name: 'Générer le devis' })).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)))).toHaveLength(1);
  });

  test('verrouille tout le wizard pendant le POST initial puis installe exactement le devis courant au 2xx', async () => {
    let resolveQuote!: (response: Response) => void;
    const pendingQuote = new Promise<Response>((resolve) => { resolveQuote = resolve; });
    installFetchRouter();
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      /\/profils\/profil-1\/quote$/.test(String(input)) ? pendingQuote : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByRole('heading', { name: 'Création du devis en cours' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Étapes du simulateur' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Mathématiques' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouveau' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dossiers récents')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes conservées')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Profil' })).not.toBeInTheDocument();

    await act(async () => { resolveQuote(jsonResponse({ body: { quote: staffQuote }, status: 201 })); });
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Lignes du devis serveur' })).toBeInTheDocument();
    const quoteCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    expect(quoteCalls).toHaveLength(1);
    expect(JSON.parse(quoteCalls[0][1].body).idempotencyKey).toEqual(expect.any(String));
  });

  test('renouvelle la clé si un nouveau profil porte les mêmes faits commerciaux', async () => {
    installFetchRouter({ profileIds: ['profil-1', 'profil-2'], quote: [new Error('network lost'), { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByText(/résultat de la création est inconnu/i);

    await user.click(screen.getByRole('button', { name: 'Nouveau' }));
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-[^/]+\/quote$/.test(String(url)));
    expect(JSON.parse(calls[0][1].body).idempotencyKey).not.toBe(JSON.parse(calls[1][1].body).idempotencyKey);
  });

  test('verrouille les éditions après erreur ambiguë puis rejoue exactement le même motif, la même clé et le même body', async () => {
    installFetchRouter({
      quote: [
        { ok: false, status: 422, body: { error: 'Validation explicite requise', marginReview: { percentage: 35, statusLabel: 'Validation de la marge requise', canOverride: true } } },
        new Error('network lost after write'),
        { body: { quote: { ...staffQuote, margin: { percentage: 35, statusLabel: 'Marge validée par le staff' } } }, status: 201 },
      ],
    });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Duo' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    const reason = await screen.findByLabelText('Motif de validation de la marge');
    await user.type(reason, 'Première validation direction');
    await user.click(screen.getByRole('button', { name: 'Valider la marge et générer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByLabelText('Motif de validation de la marge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Recharger le dossier' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Étapes du simulateur' })).not.toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Mathématiques' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modifier le profil' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes conservées')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));

    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    const firstOverride = JSON.parse(calls[1][1].body);
    const replayedOverride = JSON.parse(calls[2][1].body);
    expect(calls[2][1].body).toBe(calls[1][1].body);
    expect(replayedOverride.idempotencyKey).toBe(firstOverride.idempotencyKey);
    expect(firstOverride.marginOverride.reason).toBe('Première validation direction');
    expect(replayedOverride.marginOverride.reason).toBe('Première validation direction');
    expect(calls).toHaveLength(3);
  });

  test('conserve la tentative après un 404 puis rejoue la même clé lorsque la création initiale finit par aboutir', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: staffQuote,
    };
    installFetchRouter({ quote: [new Error('network lost after write'), { body: { quote: staffQuote }, status: 200 }], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('button', { name: 'Recharger le dossier' });
    await user.click(screen.getByRole('button', { name: 'Recharger le dossier' }));

    expect(await screen.findByText('Aucun devis trouvé pour l’instant; réessayer exactement ou relancer la vérification.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.filter(([url, init]) => String(url).endsWith('/profils/profil-1') && (init?.method ?? 'GET') === 'GET')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const createCalls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    expect(createCalls).toHaveLength(2);
    expect(createCalls[1][1].body).toBe(createCalls[0][1].body);
    expect(JSON.parse(createCalls[1][1].body).idempotencyKey).toBe(JSON.parse(createCalls[0][1].body).idempotencyKey);
  });

  test('réconcilie uniquement le devis de la clé idempotente exacte sans second POST de création', async () => {
    installFetchRouter({ quote: [new Error('network lost after write')], reconcile: { body: { quote: staffQuote }, status: 200 } });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(await screen.findByRole('button', { name: 'Recharger le dossier' }));

    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const createCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    const reconcileCall = (global.fetch as jest.Mock).mock.calls.find(([url]) => /\/profils\/profil-1\/quote\/reconcile$/.test(String(url)));
    expect(JSON.parse(reconcileCall[1].body).idempotencyKey).toBe(JSON.parse(createCall[1].body).idempotencyKey);
    expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)))).toHaveLength(1);
  });

  test('conserve l’état ambigu après un 201 dont le DTO quote est tronqué puis rejoue le body exact', async () => {
    installFetchRouter({ quote: [{ body: { quote: { id: 'quote-tronquee' } }, status: 201 }, { body: { quote: staffQuote }, status: 201 }] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Réessayer exactement' }));
    expect(await screen.findByRole('heading', { name: 'Synthèse du devis' })).toBeInTheDocument();
    const calls = (global.fetch as jest.Mock).mock.calls.filter(([url]) => /\/profils\/profil-1\/quote$/.test(String(url)));
    expect(calls[1][1].body).toBe(calls[0][1].body);
  });

  test('restaure un écran de résolution exclusif après Nouveau puis reprise du dossier ambigu', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    installFetchRouter({ profiles: [profile], profile, quote: [new Error('network lost after write')] });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await screen.findByRole('button', { name: 'Réessayer exactement' });
    await user.click(screen.getByRole('button', { name: 'Nouveau' }));
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/résultat de la création est inconnu/i);
    expect(screen.queryByRole('heading', { name: 'Profil du candidat' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enregistrer et simuler' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Notes conservées')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer exactement' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Recharger le dossier' })).toBeEnabled();
  });

  test('masque toute navigation pendant la réconciliation', async () => {
    let resolveReconcile!: (response: Response) => void;
    const pendingReconcile = new Promise<Response>((resolve) => { resolveReconcile = resolve; });
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    installFetchRouter({ profiles: [profile], quote: [new Error('network lost after write')] });
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      /\/quote\/reconcile$/.test(String(input)) ? pendingReconcile : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(screen.getByRole('button', { name: 'Recharger le dossier' }));

    expect(await screen.findByRole('heading', { name: 'Création du devis en cours' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nouveau' })).not.toBeInTheDocument();
    expect(screen.queryByText('Dossiers récents')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Étapes du simulateur' })).not.toBeInTheDocument();

    await act(async () => { resolveReconcile(jsonResponse({ ok: false, status: 404, body: {} })); });
    expect(await screen.findByRole('button', { name: 'Réessayer exactement' })).toBeEnabled();
  });

  test('ignore la réponse tardive du profil A si une navigation concurrente a chargé le profil B', async () => {
    let resolveReconcile!: (response: Response) => void;
    const pendingReconcile = new Promise<Response>((resolve) => { resolveReconcile = resolve; });
    const profileA = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    const studentB = {
      ...student, id: 'student-2', studentId: 'student-2', userId: 'student-user-2',
      user: { firstName: 'Amine', lastName: 'Trabelsi', email: 'amine@example.test', mergedIntoUserId: null },
    };
    const profileB = { ...profileA, id: 'profil-2', student: studentB };
    installFetchRouter({ profiles: [profileA, profileB], profilesById: { 'profil-2': profileB }, quote: [new Error('network lost after write')] });
    const routedFetch = global.fetch as jest.Mock;
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => (
      /\/quote\/reconcile$/.test(String(input)) ? pendingReconcile : routedFetch(input, init)
    )) as typeof fetch;
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await reachModules(user);
    await user.click(within(screen.getByRole('article', { name: 'Mathématiques' })).getByRole('button', { name: 'Individuel' }));
    await user.click(screen.getByRole('button', { name: 'Voir la proposition financière' }));
    await user.click(screen.getByRole('button', { name: 'Générer le devis' }));
    await user.click(screen.getByText('Dossiers récents'));
    const reconcile = screen.getByRole('button', { name: 'Recharger le dossier' });
    const openProfileB = screen.getByRole('button', { name: /amine trabelsi/i });

    act(() => {
      fireEvent.click(reconcile);
      fireEvent.click(openProfileB);
    });
    expect((await screen.findAllByText('Amine Trabelsi')).length).toBeGreaterThan(0);
    await act(async () => { resolveReconcile(jsonResponse({ body: { quote: staffQuote }, status: 200 })); });

    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
    expect(screen.getAllByText('Amine Trabelsi').length).toBeGreaterThan(0);
  });

  test('reprend une révision enrichie en conservant les identités et revient au profil sans devis dupliqué', async () => {
    const publishedProfile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: staffQuote,
    };
    const revision = { ...publishedProfile, id: 'profil-2', previousProfilId: 'profil-1', revisionNumber: 2, lastQuote: null };
    installFetchRouter({ profiles: [publishedProfile], profile: publishedProfile, revision: { body: { profil: revision }, status: 201 } });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));
    await user.click(screen.getByRole('button', { name: 'Créer une révision' }));

    expect(await screen.findByRole('heading', { name: 'Profil du candidat' })).toBeInTheDocument();
    expect(screen.getByText('Sonia Ben Salah')).toBeInTheDocument();
    expect(screen.getAllByText('Yasmine Ben Salah').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Synthèse du devis' })).not.toBeInTheDocument();
  });

  test('signale une dispense persistée inconnue tout en laissant visibles les contrôles supportés', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ANGLAIS', langueB: 'ESPAGNOL', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
      dispensesDeclarees: [{ epreuveId: 'UNKNOWN_EXAM', statut: 'CONFIRMEE' }],
    };
    installFetchRouter({ profiles: [profile], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(screen.getByLabelText('Dispense - Philosophie')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/dispense inconnue/i);
    await user.click(screen.getByRole('button', { name: 'Enregistrer et simuler' }));
    expect(screen.getAllByRole('alert').some((alert) => /enregistrement est bloqué/i.test(alert.textContent ?? ''))).toBe(true);
  });
});

describe('CandidatIndividuelWorkspace staff destinations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ profils: [] }) });
  });

  it.each([
    ['ADMIN', '/dashboard/admin/students'],
    ['ASSISTANTE', '/dashboard/assistante/students'],
  ] as const)('uses the curated identity destination for %s', async (staffRole, href) => {
    render(<CandidatIndividuelWorkspace staffRole={staffRole} />);

    expect(await screen.findByRole('link', { name: 'Créer ou sélectionner un élève' })).toHaveAttribute(
      'href',
      `${href}?intent=candidat-individuel`,
    );
  });
});

describe('CandidatIndividuelWorkspace language contract', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('propose les six langues en LVA et LVB et bloque un doublon avant tout payload', async () => {
    installFetchRouter();
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await selectIdentity(user);
    await user.click(screen.getByRole('button', { name: 'Continuer vers le profil' }));

    const langueA = screen.getByRole('combobox', { name: 'Langue vivante A' });
    const langueB = screen.getByRole('combobox', { name: 'Langue vivante B' });
    const expected = ['Non renseigné', 'Arabe', 'Anglais', 'Espagnol', 'Italien', 'Russe', 'Allemand'];
    for (const select of [langueA, langueB]) {
      expect(within(select).getAllByRole('option').map((option) => option.textContent)).toEqual(expected);
      expect(within(select).queryByRole('option', { name: 'Portugais' })).not.toBeInTheDocument();
    }

    await user.selectOptions(langueA, 'ARABE');
    await user.selectOptions(langueB, 'ARABE');

    expect(screen.getByRole('alert')).toHaveTextContent(DUPLICATE_LANGUAGE_MESSAGE);
    expect(langueB).toHaveAttribute('aria-invalid', 'true');
    expect(langueB).toHaveAccessibleDescription(DUPLICATE_LANGUAGE_MESSAGE);
    expect(screen.getByRole('button', { name: 'Enregistrer et simuler' })).toBeDisabled();
    expect(global.fetch).not.toHaveBeenCalledWith(
      '/api/assistante/candidat-individuel/profils',
      expect.objectContaining({ method: 'POST' }),
    );

    await user.selectOptions(langueB, 'ALLEMAND');
    expect(screen.queryByText(DUPLICATE_LANGUAGE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer et simuler' })).toBeEnabled();
  });

  test('reprend les langues persistées sans perdre leur valeur ni exposer les enums', async () => {
    const profile = {
      id: 'profil-1', level: 'TERMINALE', examSession: 2027, modalite: 'A', specialite1: 'MATHEMATIQUES', specialite2: 'NSI',
      specialiteAbandonnee: null, langueA: 'ITALIEN', langueB: 'RUSSE', optionsTerminale: [], estRedoublant: false,
      estTitulaireBacDejaObtenu: false, changementSpecialite: false, intentionAmelioration: false, intentionCycleComplet: true,
      moyenneRattrapage: null, etalementPlurisessionsDeclare: false, brancheBascule: null, contactLead: lead, student, lastQuote: null,
    };
    installFetchRouter({ profiles: [profile], profile });
    const user = userEvent.setup();
    render(<CandidatIndividuelWorkspace />);
    await user.click(screen.getByText('Dossiers récents'));
    await user.click(await screen.findByRole('button', { name: /yasmine ben salah/i }));

    expect(screen.getByRole('combobox', { name: 'Langue vivante A' })).toHaveValue('ITALIEN');
    expect(screen.getByRole('combobox', { name: 'Langue vivante B' })).toHaveValue('RUSSE');
    expect(screen.getByRole('combobox', { name: 'Langue vivante A' })).toHaveDisplayValue('Italien');
    expect(screen.getByRole('combobox', { name: 'Langue vivante B' })).toHaveDisplayValue('Russe');
  });
});
