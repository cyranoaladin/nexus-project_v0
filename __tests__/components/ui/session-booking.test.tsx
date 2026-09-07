/**
 * `components/ui/session-booking.tsx` — réservation ELEVE/PARENT.
 *
 * Régression : la Tâche 12 (commit 7c3c2a713) a remplacé le contrat de
 * `POST /api/sessions/book` (canonique `studentId`/`coachId`/`assignmentId`/
 * `academicCourseKey`, où `studentId`/`coachId` sont désormais `Student.id`/
 * `CoachProfile.id`, jamais `User.id`), mais ce composant continuait
 * d'envoyer l'ancienne forme (`coachId: User.id` choisi en parcourant
 * n'importe quel coach par matière, `subject`). Ce test verrouille le
 * nouveau flux : choisir une assignation active propre → choisir un cours de
 * son périmètre → choisir un créneau avec CE coach assigné, et la forme
 * réellement envoyée au nouveau contrat.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

/**
 * Radix Select n'expose pas de `combobox` sous jsdom (API pointeur absentes)
 * — remplacé par un `<select>` natif, même convention que
 * `__tests__/components/dashboard/parent/add-child-dialog.test.tsx`.
 */
jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      data-testid="mock-select"
      value={value ?? ''}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="">--</option>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

/**
 * Sous jsdom, `AnimatePresence`/`motion.*` de framer-motion introduisent un
 * décalage de mise à jour (frames d'animation jamais résolues) qui laisse le
 * DOM affiché en retard d'un rendu — non spécifique à ce composant, déjà
 * observé sur toute page utilisant `motion.div`/`AnimatePresence` sous RTL.
 * Remplacé par un passthrough qui rend directement le tag HTML demandé, sans
 * toucher au reste du comportement (mêmes props DOM, mêmes enfants).
 */
jest.mock('framer-motion', () => {
  // `React` (importé plus haut dans ce fichier) est disponible ici : la
  // factory `jest.mock` est hoistée mais exécutée seulement au premier
  // `require('framer-motion')`, après l'exécution des imports du module.
  const ReactActual = React;
  // Le composant retourné par le Proxy DOIT être mémoïsé par tag : sinon
  // `<motion.div>` résout une IDENTITÉ DE COMPOSANT différente à chaque
  // rendu (nouvel accès de propriété via le Proxy), ce que React traite
  // comme un TYPE différent — il démonte/remonte tout le sous-arbre à
  // chaque rendu (donc les boutons/enfants perdent leur état/ref).
  const cache = new Map<string, any>();
  const passthrough = new Proxy(
    {},
    {
      get: (_target, tag: string) => {
        if (!cache.has(tag)) {
          cache.set(
            tag,
            ReactActual.forwardRef((props: any, ref: any) => {
              const {
                initial, animate, exit, transition, whileHover, whileTap, whileFocus, whileDrag,
                layout, layoutId, variants, ...rest
              } = props;
              return ReactActual.createElement(tag, { ...rest, ref });
            }),
          );
        }
        return cache.get(tag);
      },
    },
  );
  return {
    motion: passthrough,
    AnimatePresence: ({ children }: any) => <>{children}</>,
    useReducedMotion: () => false,
  };
});

import SessionBooking from '@/components/ui/session-booking';

const STUDENT_USER_ID = 'student-user-1';
const CANONICAL_STUDENT_ID = 'student-entity-1';
const ASSIGNMENT_ID = 'assignment-1';
const COACH_PROFILE_ID = 'coach-profile-1';
const COACH_USER_ID = 'coach-user-1';
const COURSE_KEY = 'eds-maths-terminale';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

describe('SessionBooking', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows a clear message when the student has zero active assignments', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/student/assignments')) {
        return Promise.resolve(jsonResponse({ success: true, studentId: CANONICAL_STUDENT_ID, assignments: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    }) as typeof fetch);

    render(<SessionBooking studentId={STUDENT_USER_ID} onBookingComplete={jest.fn()} />);

    expect(await screen.findByTestId('booking-no-assignment')).toHaveTextContent(
      /Aucun coach ne vous est actuellement assigné/,
    );
  });

  it('auto-selects the sole active assignment and course, then books through the new canonical contract', async () => {
    const onBookingComplete = jest.fn();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method ?? 'GET';

      if (url.startsWith('/api/student/assignments')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            studentId: CANONICAL_STUDENT_ID,
            assignments: [
              {
                id: ASSIGNMENT_ID,
                coachProfileId: COACH_PROFILE_ID,
                coachUserId: COACH_USER_ID,
                coachName: 'Jean Coach',
                coachPseudonym: 'Hélios',
                academicCourseKeys: [{ courseKey: COURSE_KEY, label: 'Mathématiques Terminale' }],
              },
            ],
          }),
        );
      }
      if (url.startsWith('/api/coaches/availability')) {
        expect(url).toContain(`coachId=${COACH_USER_ID}`);
        return Promise.resolve(
          jsonResponse({
            success: true,
            availableSlots: [
              { date: '2026-09-14', startTime: '10:00', endTime: '11:00', duration: 60 },
            ],
          }),
        );
      }
      if (url === '/api/sessions/book' && method === 'POST') {
        return Promise.resolve(jsonResponse({ success: true, sessionId: 'session-1' }, 201));
      }
      return Promise.resolve(jsonResponse({}));
    }) as typeof fetch);

    render(<SessionBooking studentId={STUDENT_USER_ID} onBookingComplete={onBookingComplete} />);

    // Step 1: une seule assignation active → auto-sélectionnée, un seul
    // cours dans son périmètre → auto-sélectionné. "Suivant" devient actif
    // sans aucune interaction de sélection.
    const step1Next = await screen.findByTestId('booking-step1-next');
    await waitFor(() => expect(step1Next).toBeEnabled());
    fireEvent.click(step1Next);

    // Step 2: créneau chargé pour le coach de CETTE assignation (coachUserId).
    const slot = await screen.findByTestId('booking-slot-0');
    fireEvent.click(slot);
    fireEvent.click(screen.getByTestId('booking-step2-next'));

    // Step 3: détails puis confirmation.
    fireEvent.change(await screen.findByTestId('booking-title'), {
      target: { value: 'Révisions dérivation' },
    });
    fireEvent.click(screen.getByTestId('booking-confirm'));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/sessions/book',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const postCall = fetchMock.mock.calls.find(
      ([u, i]) => u === '/api/sessions/book' && (i as RequestInit)?.method === 'POST',
    );
    expect(postCall).toBeDefined();
    const body = JSON.parse((postCall![1] as RequestInit).body as string);

    expect(body).toMatchObject({
      studentId: CANONICAL_STUDENT_ID,
      coachId: COACH_PROFILE_ID,
      assignmentId: ASSIGNMENT_ID,
      academicCourseKey: COURSE_KEY,
      scheduledDate: '2026-09-14',
      startTime: '10:00',
      endTime: '11:00',
      duration: 60,
      title: 'Révisions dérivation',
    });
    // Forme abandonnée par la Tâche 12 : ne doit plus jamais être envoyée.
    expect(body).not.toHaveProperty('subject');
    expect(body).not.toHaveProperty('parentId');
    // `coachId`/`studentId` sont désormais des identités canoniques —
    // jamais le `User.id` brut passé en prop.
    expect(body.coachId).not.toBe(COACH_USER_ID);
    expect(body.studentId).not.toBe(STUDENT_USER_ID);

    await waitFor(() => expect(onBookingComplete).toHaveBeenCalledWith('session-1'));
  });

  it('lets the student choose among several active assignments', async () => {
    const secondAssignment = {
      id: 'assignment-2',
      coachProfileId: 'coach-profile-2',
      coachUserId: 'coach-user-2',
      coachName: 'Marie Autre',
      coachPseudonym: 'Zénon',
      academicCourseKeys: [{ courseKey: 'eds-nsi-terminale', label: 'NSI Terminale' }],
    };
    jest.spyOn(global, 'fetch').mockImplementation(((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.startsWith('/api/student/assignments')) {
        return Promise.resolve(
          jsonResponse({
            success: true,
            studentId: CANONICAL_STUDENT_ID,
            assignments: [
              {
                id: ASSIGNMENT_ID,
                coachProfileId: COACH_PROFILE_ID,
                coachUserId: COACH_USER_ID,
                coachName: 'Jean Coach',
                coachPseudonym: 'Hélios',
                academicCourseKeys: [{ courseKey: COURSE_KEY, label: 'Mathématiques Terminale' }],
              },
              secondAssignment,
            ],
          }),
        );
      }
      if (url.startsWith('/api/coaches/availability')) {
        return Promise.resolve(jsonResponse({ success: true, availableSlots: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    }) as typeof fetch);

    render(<SessionBooking studentId={STUDENT_USER_ID} onBookingComplete={jest.fn()} />);

    await waitFor(() => expect(screen.getByTestId('booking-step1-next')).toBeDisabled());

    const select = screen.getByTestId('mock-select');
    fireEvent.change(select, { target: { value: 'assignment-2' } });

    // Le cours unique de la deuxième assignation s'auto-sélectionne aussi.
    await waitFor(() => expect(screen.getByTestId('booking-step1-next')).toBeEnabled());
  });
});
