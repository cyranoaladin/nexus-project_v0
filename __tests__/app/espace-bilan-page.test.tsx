const guard = jest.fn();
const open = jest.fn();
const annotations = jest.fn();
jest.mock('@/lib/espace/page-guard', () => ({ requireActorForPage: (...a: unknown[]) => guard(...a) }));
jest.mock('@/lib/espace/works', () => ({ openWork: (...a: unknown[]) => open(...a) }));
jest.mock('@/lib/espace/annotations', () => ({ listAnnotations: (...a: unknown[]) => annotations(...a) }));
jest.mock('@/lib/espace/overview', () => ({ fullName: (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}` }));
jest.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
jest.mock('@/components/espace/student/BilanWorkbench', () => ({ BilanWorkbench: () => null }));
import Page from '@/app/espace/bilan/[level]/page';
import { EspaceError } from '@/lib/espace/errors';

beforeEach(() => {
  jest.clearAllMocks();
  guard.mockResolvedValue({ id: 'student-test', role: 'ELEVE', firstName: 'Élève', lastName: 'Test' });
  open.mockResolvedValue({ id: 'work-test', status: 'DRAFT', revision: 0, currentStep: 0, lastSavedAt: '2026-10-01T12:00:00Z', content: { v: 1, steps: {} } });
  annotations.mockResolvedValue([]);
});

it('la page ouvre le bilan attribué et utilise uniquement l’identité de la session', async () => {
  const page = await Page({ params: Promise.resolve({ level: '3e' }), searchParams: Promise.resolve({ seance: 'assigned' }) });
  expect(guard).toHaveBeenCalledWith(['ELEVE'], '/espace/bilan/3e?seance=assigned');
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: 'student-test' }), { activitySlug: 'maths-bilan-septembre-2026-3e', sessionId: 'assigned' });
  expect(page).toMatchObject({ props: { userId: 'student-test', studentName: 'Élève Test', level: '3e' } });
});

it('la page refuse un niveau inconnu avant toute ouverture', async () => {
  await expect(Page({ params: Promise.resolve({ level: 'terminale' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(open).not.toHaveBeenCalled();
});

it('la page refuse un élève sans attribution sans lire ses annotations', async () => {
  open.mockRejectedValue(new EspaceError('NOT_FOUND', 'Travail introuvable'));
  await expect(Page({ params: Promise.resolve({ level: '2nde' }), searchParams: Promise.resolve({}) })).rejects.toThrow('NEXT_NOT_FOUND');
  expect(annotations).not.toHaveBeenCalled();
});

it.each(['tle-maths', 'tle-nsi'])('ouvre le profil terminale %s dans le parcours existant avec sa séance', async level => {
  const page = await Page({ params: Promise.resolve({ level }), searchParams: Promise.resolve({ seance: 'terminal-session' }) });
  expect(guard).toHaveBeenCalledWith(['ELEVE'], `/espace/bilan/${level}?seance=terminal-session`);
  expect(page).toMatchObject({ props: { level, userId: 'student-test' } });
  expect(open).toHaveBeenCalledWith(expect.anything(), { activitySlug: expect.stringMatching(level === 'tle-nsi' ? /^nsi-bilan-/ : /^maths-bilan-/), sessionId: 'terminal-session' });
});
