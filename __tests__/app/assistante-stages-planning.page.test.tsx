/**
 * `app/dashboard/assistante/stages/planning/page.tsx` — création de séance.
 *
 * Régression : la Tâche 11 (commit 513dafcaa) a remplacé le contrat de
 * `POST /api/assistante/sessions` (canonique `studentProfileId`/
 * `coachProfileId`/`assignmentId`/`academicCourseKey` + `override` énuméré),
 * mais cette page continuait d'envoyer l'ancienne forme
 * (`studentId`/`coachId`/`subject`/`override: boolean`). Ce test verrouille
 * la forme du payload réellement envoyé au nouveau contrat.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssistantePlanningPage from '@/app/dashboard/assistante/stages/planning/page';

const mockRouter = { push: jest.fn() };

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}));

let mockSession = { data: { user: { id: 'staff-1', role: 'ASSISTANTE' } }, status: 'authenticated' };
jest.mock('next-auth/react', () => ({
  useSession: () => mockSession,
}));

const STUDENT_ENTITY_ID = 'student-entity-1';
const STUDENT_USER_ID = 'student-user-1';
const COACH_PROFILE_ID = 'coach-profile-1';
const COACH_USER_ID = 'coach-user-1';
const ASSIGNMENT_ID = 'assignment-1';
const COURSE_KEY = 'eds-maths-terminale';

function installFetchMock(events: unknown[] = []) {
  return jest.spyOn(global, 'fetch').mockImplementation(((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';

    if (url.startsWith('/api/assistante/planning')) {
      return Promise.resolve({ ok: true, json: async () => ({ events }) } as Response);
    }
    if (url.startsWith('/api/assistante/students')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          students: [
            {
              id: STUDENT_ENTITY_ID,
              user: { id: STUDENT_USER_ID, firstName: 'Nora', lastName: 'Test', email: 'nora@example.test' },
            },
          ],
        }),
      } as Response);
    }
    if (url.startsWith('/api/assistante/coaches')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          coaches: [
            {
              id: COACH_PROFILE_ID,
              userId: COACH_USER_ID,
              pseudonym: 'CoachPseudo',
              firstName: 'Jean',
              lastName: 'Coach',
              email: 'jean.coach@example.test',
            },
          ],
        }),
      } as Response);
    }
    if (url.startsWith('/api/assistante/assignments')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          assignments: [
            { id: ASSIGNMENT_ID, assignmentType: 'PRIMARY', academicCourseKeys: [COURSE_KEY] },
          ],
        }),
      } as Response);
    }
    if (url === '/api/assistante/sessions' && method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ success: true, seriesId: 'series-1', sessions: [] }),
      } as Response);
    }

    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as typeof fetch);
}

afterEach(() => {
  jest.restoreAllMocks();
  mockSession = { data: { user: { id: 'staff-1', role: 'ASSISTANTE' } }, status: 'authenticated' };
});

async function selectStudentAndCoach() {
  fireEvent.click(await screen.findByRole('button', { name: /Nouvelle séance/i }));

  const studentInput = await screen.findByPlaceholderText('Rechercher… (nom/email)');
  fireEvent.change(studentInput, { target: { value: 'Nora' } });
  const studentOption = await screen.findByText('Nora Test');
  fireEvent.click(studentOption);

  const coachInput = await screen.findByPlaceholderText('Rechercher… (pseudo/email)');
  fireEvent.change(coachInput, { target: { value: 'Coach' } });
  const coachOption = await screen.findByText('CoachPseudo');
  fireEvent.click(coachOption);
}

it('sends the governed session-creation payload (studentProfileId/coachProfileId/assignmentId/academicCourseKey), never the legacy shape', async () => {
  const fetchMock = installFetchMock();
  render(<AssistantePlanningPage />);

  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/assistante/planning')));

  await selectStudentAndCoach();

  // L'assignation active + son cours sont pré-sélectionnés automatiquement
  // dès lors qu'une seule assignation existe entre cet élève et ce coach.
  await waitFor(() => expect(screen.getByRole('button', { name: 'Créer' })).toBeEnabled());

  fireEvent.change(screen.getByPlaceholderText('Ex: Maths — dérivation'), { target: { value: 'Séance de test' } });

  fireEvent.click(screen.getByRole('button', { name: 'Créer' }));

  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/assistante/sessions',
      expect.objectContaining({ method: 'POST' }),
    ),
  );

  const postCall = fetchMock.mock.calls.find(([u, init]) => u === '/api/assistante/sessions' && (init as RequestInit)?.method === 'POST');
  expect(postCall).toBeDefined();
  const body = JSON.parse((postCall![1] as RequestInit).body as string);

  expect(body).toMatchObject({
    studentProfileId: STUDENT_ENTITY_ID,
    coachProfileId: COACH_PROFILE_ID,
    assignmentId: ASSIGNMENT_ID,
    academicCourseKey: COURSE_KEY,
    title: 'Séance de test',
  });
  // Forme abandonnée par la Tâche 11 : ne doit plus jamais être envoyée.
  expect(body).not.toHaveProperty('studentId');
  expect(body).not.toHaveProperty('coachId');
  expect(body).not.toHaveProperty('subject');
  // ASSISTANTE ne peut structurellement fournir aucune dérogation.
  expect(body).not.toHaveProperty('override');
});

it('disables session creation and points staff to the assignments page when no active assignment exists', async () => {
  const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.startsWith('/api/assistante/planning')) {
      return Promise.resolve({ ok: true, json: async () => ({ events: [] }) } as Response);
    }
    if (url.startsWith('/api/assistante/students')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ students: [{ id: STUDENT_ENTITY_ID, user: { id: STUDENT_USER_ID, firstName: 'Nora', lastName: 'Test', email: 'nora@example.test' } }] }),
      } as Response);
    }
    if (url.startsWith('/api/assistante/coaches')) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ coaches: [{ id: COACH_PROFILE_ID, userId: COACH_USER_ID, pseudonym: 'CoachPseudo', firstName: 'Jean', lastName: 'Coach', email: 'jean.coach@example.test' }] }),
      } as Response);
    }
    if (url.startsWith('/api/assistante/assignments')) {
      return Promise.resolve({ ok: true, json: async () => ({ assignments: [] }) } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  }) as typeof fetch);

  render(<AssistantePlanningPage />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/assistante/planning')));

  await selectStudentAndCoach();

  expect(await screen.findByText(/Aucune assignation active entre cet élève et ce coach/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Créer une assignation d.abord/ })).toHaveAttribute(
    'href',
    '/dashboard/assistante/assignments',
  );
  expect(screen.getByRole('button', { name: 'Créer' })).toBeDisabled();
});

it('shows the override control only for ADMIN, never for ASSISTANTE', async () => {
  mockSession = { data: { user: { id: 'admin-1', role: 'ADMIN' } }, status: 'authenticated' };
  installFetchMock();
  render(<AssistantePlanningPage />);

  fireEvent.click(await screen.findByRole('button', { name: /Nouvelle séance/i }));
  expect(await screen.findByText(/Dérogation ADMIN/)).toBeInTheDocument();
});

it.each(['network', 'body'])('retains the cancellation command after an uncertain %s failure', async failure => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const alert = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  const now = new Date();
  const fetchMock = installFetchMock([{ id: 'sessionBooking:clh1234567890abcdefghij', source: 'SESSION_BOOKING', title: 'Synthetic retry session', subject: 'MATHEMATIQUES', startAt: now.toISOString(), endAt: new Date(now.getTime() + 3600000).toISOString(), location: null }]);
  const original = fetchMock.getMockImplementation()!;
  let attempts = 0;
  fetchMock.mockImplementation((input, init) => {
    if (input === '/api/sessions/cancel') {
      attempts++;
      if (attempts === 1) return failure === 'network'
        ? Promise.reject(new Error('Synthetic network failure'))
        : Promise.resolve({ ok: true, status: 200, json: async () => { throw new Error('Synthetic body failure'); } } as unknown as Response);
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) } as Response);
    }
    return original(input, init);
  });
  render(<AssistantePlanningPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic retry session/i }));
  fireEvent.click(screen.getByRole('button', { name: 'Annuler la séance' }));
  await waitFor(() => expect(alert).toHaveBeenCalled());
  const retry = await screen.findByRole('button', { name: 'Annuler la séance' });
  await waitFor(() => expect(retry).toBeEnabled());
  fireEvent.click(retry);
  await waitFor(() => expect(attempts).toBe(2));
  const calls = fetchMock.mock.calls.filter(([url]) => url === '/api/sessions/cancel');
  const first = new Headers(calls[0][1]?.headers).get('Idempotency-Key');
  const second = new Headers(calls[1][1]?.headers).get('Idempotency-Key');
  expect(first).toMatch(/^[0-9a-f-]{36}$/i);
  expect(second).toBe(first);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Annuler la séance' })).not.toBeInTheDocument());
});

it('blocks a second cancellation while the first command is pending', async () => {
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  const now = new Date();
  const fetchMock = installFetchMock([{ id: 'sessionBooking:clh1234567890abcdefghij', source: 'SESSION_BOOKING', title: 'Synthetic pending session', subject: 'MATHEMATIQUES', startAt: now.toISOString(), endAt: new Date(now.getTime() + 3600000).toISOString(), location: null }]);
  const original = fetchMock.getMockImplementation()!;
  let finish!: (response: Response) => void;
  const pending = new Promise<Response>(resolve => { finish = resolve; });
  fetchMock.mockImplementation((input, init) => input === '/api/sessions/cancel' ? pending : original(input, init));
  render(<AssistantePlanningPage />);
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic pending session/i }));
  const cancel = screen.getByRole('button', { name: 'Annuler la séance' });
  fireEvent.click(cancel);
  fireEvent.click(cancel);
  expect(fetchMock.mock.calls.filter(([url]) => url === '/api/sessions/cancel')).toHaveLength(1);
  expect(await screen.findByRole('button', { name: 'Annulation en cours…' })).toBeDisabled();
  await act(async () => { finish({ ok: true, status: 200, json: async () => ({ success: true }) } as Response); });
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Annulation en cours…' })).not.toBeInTheDocument());
});
