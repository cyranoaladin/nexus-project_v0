import type { EspaceActor } from '@/lib/espace/guards';

const activityFind = jest.fn();
const enrollmentFind = jest.fn();
const enrollmentList = jest.fn();
const sessionFind = jest.fn();
const sessionList = jest.fn();
const workFind = jest.fn();
const workList = jest.fn();
const workCreate = jest.fn();
const workUpdate = jest.fn();
const transaction = jest.fn();
jest.mock('@/lib/prisma', () => ({ prisma: {
  espaceActivity: { findUnique: (...a: unknown[]) => activityFind(...a) },
  espaceEnrollment: { findFirst: (...a: unknown[]) => enrollmentFind(...a), findMany: (...a: unknown[]) => enrollmentList(...a) },
  espaceSession: { findFirst: (...a: unknown[]) => sessionFind(...a), findMany: (...a: unknown[]) => sessionList(...a) },
  espaceWork: { findUnique: (...a: unknown[]) => workFind(...a), findMany: (...a: unknown[]) => workList(...a), create: (...a: unknown[]) => workCreate(...a), update: (...a: unknown[]) => workUpdate(...a) },
  $transaction: (...a: unknown[]) => transaction(...a),
} }));

import { loadWorkForActor } from '@/lib/espace/access';
import { getStudentDashboard } from '@/lib/espace/overview';
import { openWork, saveWork, submitWork } from '@/lib/espace/works';

const slug = 'maths-bilan-septembre-2026-3e';
const otherSlug = 'maths-bilan-septembre-2026-2nde';
const actor = { id: 'student-test', role: 'ELEVE', firstName: 'Élève' } as EspaceActor;
const activity = { id: 'activity-test', slug, title: 'Bilan troisième', subject: 'MATHEMATIQUES', kind: 'RESOURCE_PACK', stepsTotal: 8 };
const now = new Date('2026-10-01T12:00:00Z');
const work = { id: 'work-test', studentId: actor.id, activityId: activity.id, activity, sessionId: 'session-test', status: 'IN_PROGRESS', content: { v: 1, steps: {} }, currentStep: 0, progressSteps: 0, revision: 0, startedAt: now, lastSavedAt: now, submittedAt: null, correctedAt: null, reopenedAt: null };

beforeEach(() => {
  jest.clearAllMocks();
  activityFind.mockResolvedValue(activity);
  enrollmentFind.mockResolvedValue({ id: 'enrollment-test' });
  enrollmentList.mockResolvedValue([{ subject: 'MATHEMATIQUES' }]);
  sessionFind.mockResolvedValue(null);
  sessionList.mockResolvedValue([]);
  workFind.mockResolvedValue(work);
  workList.mockResolvedValue([work]);
});

describe('bilan — attribution obligatoire à une séance publiée', () => {
  it('refuse l’ouverture sans sessionId si aucune séance publiée ne l’attribue', async () => {
    await expect(openWork(actor, { activitySlug: slug })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(workCreate).not.toHaveBeenCalled();
  });

  it('retrouve la séance attribuée sans sessionId et vérifie activité, statut et participant', async () => {
    sessionFind.mockResolvedValue({ id: 'session-test' });
    await expect(openWork(actor, { activitySlug: slug })).resolves.toMatchObject({ id: work.id });
    expect(sessionFind).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ activityId: activity.id, status: 'PUBLISHED', participants: { some: { userId: actor.id } } }) }));
  });

  it('refuse une séance explicite qui ne correspond pas à son attribution', async () => {
    await expect(openWork(actor, { activitySlug: slug, sessionId: 'wrong-session' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(sessionFind).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: 'wrong-session' }) }));
  });

  it('refuse de lire un ancien bilan après retrait de l’attribution', async () => {
    await expect(loadWorkForActor(actor, work.id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuse aussi la sauvegarde après retrait de l’attribution', async () => {
    await expect(saveWork(actor, work.id, { baseRevision: 0, patch: { stepId: 'scope', step: { fields: { other: 'Essai' } } } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuse la remise après retrait de l’attribution', async () => {
    await expect(submitWork(actor, work.id, 0)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('ne change pas l’accès des activités historiques sans séance', async () => {
    const historical = { ...work, activity: { ...activity, slug: 'maths-fonctions-limites' } };
    workFind.mockResolvedValue(historical);
    activityFind.mockResolvedValue(historical.activity);
    await expect(openWork(actor, { activitySlug: historical.activity.slug })).resolves.toMatchObject({ id: work.id });
    await expect(loadWorkForActor(actor, work.id)).resolves.toMatchObject({ mode: 'student' });
    expect(sessionFind).not.toHaveBeenCalled();
  });

  it('ne masque pas à l’administrateur une copie historique à relire', async () => {
    await expect(loadWorkForActor({ ...actor, role: 'ADMIN' }, work.id, 'teacher')).resolves.toMatchObject({ mode: 'teacher' });
  });
});

describe('bilan — catalogue et tableau de bord personnels', () => {
  it('masque les bilans non attribués, y compris les anciens travaux et le prochain travail', async () => {
    const dashboard = await getStudentDashboard(actor);
    expect(dashboard.subjects.flatMap(s => s.activities).some(a => a.slug === slug || a.slug === otherSlug)).toBe(false);
    expect(dashboard.works).toEqual([]);
    expect(dashboard.next).toBeNull();
    expect(dashboard.subjects.flatMap(s => s.activities).some(a => a.slug === 'maths-fonctions-limites')).toBe(true);
  });

  it('montre uniquement le bilan attribué, même sans paramètre seance dans le lien catalogue', async () => {
    sessionList.mockResolvedValue([{ id: 'session-test', subject: 'MATHEMATIQUES', activity, works: [] }]);
    const dashboard = await getStudentDashboard(actor);
    const slugs = dashboard.subjects.flatMap(s => s.activities).map(a => a.slug);
    expect(slugs).toContain(slug);
    expect(slugs).not.toContain(otherSlug);
    expect(dashboard.works).toHaveLength(1);
    expect(dashboard.next).toMatchObject({ activitySlug: slug, sessionId: 'session-test' });
  });
});

describe.each([
  ['maths-bilan-septembre-2026-3e','MATHEMATIQUES'],
  ['maths-bilan-septembre-2026-2nde','MATHEMATIQUES'],
  ['maths-bilan-septembre-2026-terminale','MATHEMATIQUES'],
  ['nsi-bilan-septembre-2026-terminale','NSI'],
])('retrait de l’inscription pour %s', (activitySlug, subject) => {
  beforeEach(() => {
    sessionFind.mockResolvedValue({id:'session-test'});
    enrollmentFind.mockResolvedValue(null);
    workFind.mockResolvedValue({...work,activity:{...activity,slug:activitySlug,subject}});
  });
  it('refuse lecture, modification et transmission même si une place publiée subsiste', async () => {
    await expect(loadWorkForActor(actor,work.id)).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(saveWork(actor,work.id,{baseRevision:0,patch:{stepId:'scope',step:{fields:{other:'après retrait'}}}})).rejects.toMatchObject({code:'NOT_FOUND'});
    await expect(submitWork(actor,work.id,0)).rejects.toMatchObject({code:'NOT_FOUND'});
    expect(enrollmentFind).toHaveBeenCalledWith(expect.objectContaining({where:{userId:actor.id,subject}}));
    expect(transaction).not.toHaveBeenCalled();
  });
});
