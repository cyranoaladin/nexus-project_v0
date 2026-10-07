import { nextInQueue, orderQueue, type QueueRow } from '@/components/espace/teacher/correction-queue';
import { buildAnnotationPayload, canApplyReview, describeTarget, type AnnotationDraft } from '@/components/espace/teacher/annotation-draft';

const row = (workId: string | null, status: QueueRow['status'], name = workId ?? 'x'): QueueRow => ({ workId, status, name });

describe('file de correction', () => {
  it('place les travaux remis en premier, ignore les élèves sans travail', () => {
    const rows = [row('a', 'IN_PROGRESS'), row(null, 'NOT_STARTED'), row('b', 'SUBMITTED'), row('c', 'CORRECTED'), row('d', 'SUBMITTED')];
    expect(orderQueue(rows).map((r) => r.workId)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('« élève suivant » : le prochain remis après le courant, en bouclant', () => {
    const rows = [row('a', 'SUBMITTED'), row('b', 'SUBMITTED'), row('c', 'SUBMITTED')];
    expect(nextInQueue(rows, 'a')?.workId).toBe('b');
    expect(nextInQueue(rows, 'c')?.workId).toBe('a');
  });

  it('saute les travaux déjà traités et le travail courant', () => {
    const rows = [row('a', 'SUBMITTED'), row('b', 'CORRECTED'), row('c', 'IN_PROGRESS'), row('d', 'SUBMITTED')];
    expect(nextInQueue(rows, 'a')?.workId).toBe('d');
    expect(nextInQueue(rows, 'd')?.workId).toBe('a');
  });

  it('aucun suivant quand le courant est le seul remis', () => {
    expect(nextInQueue([row('a', 'SUBMITTED'), row('b', 'DONE')], 'a')).toBeNull();
    expect(nextInQueue([], 'a')).toBeNull();
  });

  it('courant déjà corrigé : renvoie le premier remis restant', () => {
    expect(nextInQueue([row('a', 'CORRECTED'), row('b', 'SUBMITTED')], 'a')?.workId).toBe('b');
  });
});

const draft = (over: Partial<AnnotationDraft> = {}): AnnotationDraft => ({ kind: 'GENERAL', body: 'Bien.', stepId: '', questionId: '', lineStart: '', lineEnd: '', ...over });

describe('brouillon d’annotation', () => {
  it('global : texte seul', () => {
    expect(buildAnnotationPayload(draft())).toEqual({ ok: true, payload: { kind: 'GENERAL', body: 'Bien.' } });
  });

  it('texte vide ou trop long refusé', () => {
    expect(buildAnnotationPayload(draft({ body: '   ' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ body: 'a'.repeat(4001) }))).toMatchObject({ ok: false });
  });

  it('étape : étape requise', () => {
    expect(buildAnnotationPayload(draft({ kind: 'STEP' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'STEP', stepId: 'agir' }))).toEqual({ ok: true, payload: { kind: 'STEP', body: 'Bien.', stepId: 'agir' } });
  });

  it('question : étape ET question requises', () => {
    expect(buildAnnotationPayload(draft({ kind: 'QUESTION', stepId: 'agir' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'QUESTION', stepId: 'agir', questionId: 'echec' }))).toMatchObject({
      ok: true,
      payload: { kind: 'QUESTION', stepId: 'agir', questionId: 'echec' },
    });
  });

  it('code : ligne requise, plage cohérente, bornes', () => {
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir', lineStart: '5', lineEnd: '2' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir', lineStart: '0' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir', lineStart: '3.5' }))).toMatchObject({ ok: false });
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir', lineStart: '3', lineEnd: '4' }))).toEqual({
      ok: true,
      payload: { kind: 'CODE', body: 'Bien.', stepId: 'agir', lineStart: 3, lineEnd: 4 },
    });
    expect(buildAnnotationPayload(draft({ kind: 'CODE', stepId: 'agir', lineStart: '7' }))).toMatchObject({ payload: { lineStart: 7 } });
  });

  it('ne transmet pas de cible parasite pour un commentaire global', () => {
    const r = buildAnnotationPayload(draft({ stepId: 'agir', questionId: 'q', lineStart: '3' }));
    expect(r).toEqual({ ok: true, payload: { kind: 'GENERAL', body: 'Bien.' } });
  });

  it('décrit la cible pour l’affichage', () => {
    expect(describeTarget({ kind: 'GENERAL', stepId: null, questionId: null, lineStart: null, lineEnd: null })).toBe('Commentaire général');
    expect(describeTarget({ kind: 'CODE', stepId: 'agir', questionId: null, lineStart: 3, lineEnd: 3 })).toBe('Code · étape agir · ligne 3');
    expect(describeTarget({ kind: 'CODE', stepId: 'agir', questionId: null, lineStart: 3, lineEnd: 5 })).toBe('Code · étape agir · lignes 3–5');
  });
});

describe('actions de relecture', () => {
  it('suit la machine d’états', () => {
    expect(canApplyReview('SUBMITTED', 'MARK_CORRECTED')).toBe(true);
    expect(canApplyReview('IN_PROGRESS', 'MARK_CORRECTED')).toBe(false);
    expect(canApplyReview('CORRECTED', 'MARK_DONE')).toBe(true);
    expect(canApplyReview('SUBMITTED', 'MARK_DONE')).toBe(false);
    expect(canApplyReview('DONE', 'REOPEN')).toBe(true);
    expect(canApplyReview('IN_PROGRESS', 'REOPEN')).toBe(false);
  });
});
