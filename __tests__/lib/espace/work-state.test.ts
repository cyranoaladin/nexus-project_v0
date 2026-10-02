import {
  WorkTransitionError,
  actorFor,
  applyAction,
  isStudentEditable,
  statusLabelForStudent,
  statusLabelForTeacher,
  type WorkAction,
  type WorkStatus,
} from '@/lib/espace/work-state';

const ALL: WorkStatus[] = ['DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'CORRECTED', 'REOPENED', 'DONE'];

describe('work-state — édition élève', () => {
  it.each([
    ['DRAFT', true],
    ['IN_PROGRESS', true],
    ['REOPENED', true],
    ['SUBMITTED', false],
    ['CORRECTED', false],
    ['DONE', false],
  ] as const)('%s → éditable=%s', (status, editable) => {
    expect(isStudentEditable(status)).toBe(editable);
  });
});

describe('work-state — transitions', () => {
  it('enregistrer fait passer un brouillon en cours, et ne bouge pas ensuite', () => {
    expect(applyAction('DRAFT', 'SAVE')).toBe('IN_PROGRESS');
    expect(applyAction('IN_PROGRESS', 'SAVE')).toBe('IN_PROGRESS');
  });

  it("enregistrer sur un travail rouvert ne le fait pas redevenir « en cours »", () => {
    expect(applyAction('REOPENED', 'SAVE')).toBe('REOPENED');
  });

  it('remettre : en cours ou rouvert seulement', () => {
    expect(applyAction('IN_PROGRESS', 'SUBMIT')).toBe('SUBMITTED');
    expect(applyAction('REOPENED', 'SUBMIT')).toBe('SUBMITTED');
    expect(() => applyAction('DRAFT', 'SUBMIT')).toThrow(WorkTransitionError);
  });

  it('corriger : uniquement un travail remis', () => {
    expect(applyAction('SUBMITTED', 'MARK_CORRECTED')).toBe('CORRECTED');
    for (const s of ALL.filter((x) => x !== 'SUBMITTED')) {
      expect(() => applyAction(s, 'MARK_CORRECTED')).toThrow(WorkTransitionError);
    }
  });

  it('à reprendre : depuis remis, corrigé ou terminé', () => {
    for (const s of ['SUBMITTED', 'CORRECTED', 'DONE'] as const) {
      expect(applyAction(s, 'REOPEN')).toBe('REOPENED');
    }
    for (const s of ['DRAFT', 'IN_PROGRESS', 'REOPENED'] as const) {
      expect(() => applyAction(s, 'REOPEN')).toThrow(WorkTransitionError);
    }
  });

  it('terminé : uniquement depuis corrigé', () => {
    expect(applyAction('CORRECTED', 'MARK_DONE')).toBe('DONE');
    expect(() => applyAction('SUBMITTED', 'MARK_DONE')).toThrow(WorkTransitionError);
  });

  it("l'élève ne peut plus enregistrer après la remise (lecture seule)", () => {
    for (const s of ['SUBMITTED', 'CORRECTED', 'DONE'] as const) {
      expect(() => applyAction(s, 'SAVE')).toThrow(WorkTransitionError);
    }
  });

  it('toute combinaison hors table est refusée avec un code stable', () => {
    try {
      applyAction('DONE', 'SUBMIT');
      throw new Error('should not reach');
    } catch (e) {
      expect(e).toBeInstanceOf(WorkTransitionError);
      expect((e as WorkTransitionError).code).toBe('INVALID_TRANSITION');
    }
  });
});

describe('work-state — qui a le droit', () => {
  it("enregistrer/remettre = élève ; corriger/reprendre/terminer = enseignant", () => {
    const expected: Record<WorkAction, 'STUDENT' | 'TEACHER'> = {
      SAVE: 'STUDENT',
      SUBMIT: 'STUDENT',
      MARK_CORRECTED: 'TEACHER',
      REOPEN: 'TEACHER',
      MARK_DONE: 'TEACHER',
    };
    for (const [action, actor] of Object.entries(expected)) {
      expect(actorFor(action as WorkAction)).toBe(actor);
    }
  });
});

describe('work-state — libellés français', () => {
  it("l'élève voit « Remis », l'enseignant voit « À corriger » pour le même statut", () => {
    expect(statusLabelForStudent('SUBMITTED')).toBe('Remis');
    expect(statusLabelForTeacher('SUBMITTED')).toBe('À corriger');
    expect(statusLabelForStudent('REOPENED')).toBe('À reprendre');
  });

  it('chaque statut a un libellé non vide des deux côtés', () => {
    for (const s of ALL) {
      expect(statusLabelForStudent(s).length).toBeGreaterThan(0);
      expect(statusLabelForTeacher(s).length).toBeGreaterThan(0);
    }
  });
});
