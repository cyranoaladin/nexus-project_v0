/**
 * `StudentAcademicMap` (dashboard ASSISTANTE) — carte scolaire d'un élève.
 *
 * Couvre : séparation stricte lecture seule (obligatoire) / éditable
 * (spécialités, options) ; sélection catalogue uniquement (jamais de champ
 * texte libre) ; sauvegarde avec la révision lue ; gestion explicite du
 * conflit de révision (409 `ACADEMIC_REVISION_CONFLICT`).
 *
 * Hors périmètre, volontairement : l'édition de l'identité scolaire
 * (niveau/voie/voie STMG/statut) n'est pas testée ici — `StudentAcademicMap`
 * ne l'édite pas (voir le commentaire d'en-tête du composant).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentAcademicMap } from '@/components/dashboard/assistante/StudentAcademicMap';

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
import { toast } from 'sonner';

function academicMap(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    success: true,
    studentId: 'student-1',
    gradeLevel: 'TERMINALE',
    academicTrack: 'EDS_GENERALE',
    stmgPathway: null,
    schoolingStatus: 'SCHOOL_ENROLLED',
    academicRevision: 4,
    courses: [
      {
        course: { courseKey: 'tc-philosophie-terminale', label: 'Philosophie', kind: 'CORE' },
        academicStatus: 'DERIVED',
        enrollmentSource: null,
      },
      {
        course: { courseKey: 'eds-maths-terminale', label: 'Mathématiques (spécialité)', kind: 'SPECIALTY' },
        academicStatus: 'ENROLLED',
        enrollmentSource: 'ADMIN',
      },
      {
        course: { courseKey: 'eds-nsi-terminale', label: 'NSI (spécialité)', kind: 'SPECIALTY' },
        academicStatus: 'NOT_ENROLLED',
        enrollmentSource: null,
      },
      {
        course: { courseKey: 'opt-maths-expertes-terminale', label: 'Mathématiques expertes (option)', kind: 'OPTION' },
        academicStatus: 'NOT_ENROLLED',
        enrollmentSource: null,
      },
    ],
    ...overrides,
  };
}

function mockFetchGetOnly(body: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => body,
  } as Response);
}

afterEach(() => jest.restoreAllMocks());

it('affiche un état de chargement puis récupère la carte scolaire du bon élève', async () => {
  const fetchMock = mockFetchGetOnly(academicMap());
  render(<StudentAcademicMap studentId="student-1" />);

  expect(screen.getByTestId('academic-map-loading')).toBeInTheDocument();

  await screen.findByText('Scolarité');
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/assistante/students/student-1/academic-enrollments',
    expect.objectContaining({ cache: 'no-store' }),
  );
});

it('sépare le tronc commun (lecture seule) des enseignements choisis (éditables, catalogue)', async () => {
  mockFetchGetOnly(academicMap());
  render(<StudentAcademicMap studentId="student-1" />);

  await screen.findByText('Scolarité');

  // Section « Scolarité » : lecture seule — pas de case à cocher pour Philosophie.
  const scolarite = screen.getByText('Scolarité').closest('div')!.parentElement as HTMLElement;
  expect(within(scolarite).getByText('Philosophie')).toBeInTheDocument();
  expect(within(scolarite).queryByRole('checkbox')).not.toBeInTheDocument();

  // Section « Enseignements suivis » : catalogue, jamais de texte libre.
  expect(screen.getByRole('checkbox', { name: /Mathématiques \(spécialité\)/ })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: /NSI \(spécialité\)/ })).not.toBeChecked();
  expect(screen.getByRole('checkbox', { name: /Mathématiques expertes \(option\)/ })).not.toBeChecked();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

it('enregistre la sélection en cours avec la révision lue', async () => {
  const user = userEvent.setup();
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => academicMap() } as Response)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => academicMap({ academicRevision: 5, courses: academicMap().courses.map((c) => (
        c.course.courseKey === 'eds-nsi-terminale' ? { ...c, academicStatus: 'ENROLLED', enrollmentSource: 'ASSISTANTE' } : c
      )) }),
    } as Response);

  render(<StudentAcademicMap studentId="student-1" />);
  await screen.findByText('Scolarité');

  await user.click(screen.getByRole('checkbox', { name: /NSI \(spécialité\)/ }));
  await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const [putUrl, putInit] = fetchMock.mock.calls[1];
  expect(putUrl).toBe('/api/assistante/students/student-1/academic-enrollments');
  expect(putInit).toMatchObject({ method: 'PUT' });
  const putBody = JSON.parse((putInit as RequestInit).body as string);
  expect(putBody.expectedRevision).toBe(4);
  expect(putBody.courseKeys.sort()).toEqual(['eds-maths-terminale', 'eds-nsi-terminale']);
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(screen.getByRole('checkbox', { name: /NSI \(spécialité\)/ })).toBeChecked();
});

it("gère un 409 ACADEMIC_REVISION_CONFLICT en proposant explicitement un rechargement plutôt qu'un échec silencieux", async () => {
  const user = userEvent.setup();
  const fetchMock = jest
    .spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => academicMap() } as Response)
    .mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'ACADEMIC_REVISION_CONFLICT' }),
    } as Response)
    .mockResolvedValueOnce({ ok: true, json: async () => academicMap({ academicRevision: 9 }) } as Response);

  render(<StudentAcademicMap studentId="student-1" />);
  await screen.findByText('Scolarité');

  await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent(/modifiée entre-temps/);
  expect(toast.error).toHaveBeenCalled();

  // Le bouton Enregistrer est désactivé tant que la fiche périmée n'a pas été rechargée.
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();

  await user.click(within(alert).getByRole('button', { name: 'Recharger' }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
});
