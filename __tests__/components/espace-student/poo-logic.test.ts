import type { AnnotationDto } from '@/lib/espace/annotations';
import { getPooContent } from '@/lib/espace/catalog';
import {
  annotationTarget,
  bannerFor,
  clampStep,
  currentCode,
  formatBytes,
  groupAnnotations,
  insertIndent,
  isEditable,
  missingSteps,
  stepLabel,
  submitBlockedMessage,
  submitWarning,
} from '@/components/espace/student/poo-logic';

const steps = getPooContent().steps;

const note = (over: Partial<AnnotationDto>): AnnotationDto => ({
  id: 'a', kind: 'GENERAL', body: 'x', stepId: null, questionId: null, lineStart: null, lineEnd: null, workRevision: 1, authorName: 'P', createdAt: '', ...over,
});

describe('navigation', () => {
  it('borne l’index dans [0, total-1]', () => {
    expect(clampStep(-3, 8)).toBe(0);
    expect(clampStep(99, 8)).toBe(7);
    expect(clampStep(3.7, 8)).toBe(3);
    expect(clampStep(Number.NaN, 8)).toBe(0);
    expect(clampStep(2, 0)).toBe(0);
  });

  it('marque seulement le bonus comme facultatif', () => {
    expect(stepLabel(steps[7])).toMatch(/facultatif/);
    expect(stepLabel(steps[0])).not.toMatch(/facultatif/);
  });
});

describe('lecture seule', () => {
  it.each([
    ['DRAFT', 'saved', true],
    ['IN_PROGRESS', 'saved', true],
    ['REOPENED', 'offline', true],
    ['SUBMITTED', 'saved', false],
    ['CORRECTED', 'saved', false],
    ['DONE', 'saved', false],
    ['IN_PROGRESS', 'locked', false], // remis depuis un autre onglet
  ] as const)('%s / %s → éditable=%s', (status, sync, expected) => {
    expect(isEditable(status, sync)).toBe(expected);
  });

  it('bandeaux : rouvert = invitation à reprendre, remis/corrigé = lecture seule, en cours = rien', () => {
    expect(bannerFor('REOPENED', true)?.text).toBe('Ton enseignant te demande de reprendre ce travail.');
    expect(bannerFor('SUBMITTED', false)?.text).toMatch(/lecture seule/);
    expect(bannerFor('CORRECTED', false)?.text).toMatch(/corrigé/);
    expect(bannerFor('IN_PROGRESS', true)).toBeNull();
  });
});

describe('avant la remise', () => {
  it('compte les étapes obligatoires non renseignées (bonus exclu)', () => {
    expect(missingSteps(steps, {})).toBe(7);
  });

  it('avertissement au singulier / pluriel / rien à signaler', () => {
    expect(submitWarning(0)).toMatch(/lecture seule/);
    expect(submitWarning(0)).not.toMatch(/Il reste/);
    expect(submitWarning(1)).toMatch(/Il reste 1 étape non renseignée\./);
    expect(submitWarning(3)).toMatch(/Il reste 3 étapes non renseignées\./);
  });

  it('message de blocage selon la cause', () => {
    expect(submitBlockedMessage('conflict')).toMatch(/conflit/);
    expect(submitBlockedMessage('offline')).toMatch(/pas encore enregistré/);
  });
});

describe('retours de l’enseignant', () => {
  it('regroupe par étape, le global à part', () => {
    const g = groupAnnotations([note({ id: '1' }), note({ id: '2', stepId: 'reperes', kind: 'STEP' }), note({ id: '3', stepId: 'reperes', kind: 'CODE', lineStart: 2, lineEnd: 2 })]);
    expect(g.general.map((a) => a.id)).toEqual(['1']);
    expect(g.byStep.reperes.map((a) => a.id)).toEqual(['2', '3']);
  });

  it('décrit la cible en français', () => {
    expect(annotationTarget(note({ kind: 'CODE', lineStart: 3, lineEnd: 5 }))).toBe('Code, lignes 3 à 5');
    expect(annotationTarget(note({ kind: 'CODE', lineStart: 3, lineEnd: 3 }))).toBe('Code, ligne 3');
    const q = steps[0].questions[0];
    expect(annotationTarget(note({ kind: 'QUESTION', questionId: q.id, stepId: steps[0].id }), steps[0])).toContain(q.text);
    expect(annotationTarget(note({ kind: 'GENERAL' }))).toBe('Commentaire général');
  });
});

describe('éditeur', () => {
  it('Tab insère 4 espaces à la sélection et place le curseur après', () => {
    expect(insertIndent('ab', 1, 1)).toEqual({ value: 'a    b', cursor: 5 });
    expect(insertIndent('abcd', 1, 3)).toEqual({ value: 'a    d', cursor: 5 }); // la sélection est remplacée
  });

  it('affiche le code de départ tant que l’élève n’a rien écrit, puis son code', () => {
    expect(currentCode(steps[0], undefined)).toBe(steps[0].starter);
    expect(currentCode(steps[0], { code: 'x = 1' })).toBe('x = 1');
    expect(currentCode(steps[6], undefined)).toBe(''); // étape bilan : starter null
  });

  it('formate les tailles de fichier', () => {
    expect(formatBytes(512)).toBe('512 o');
    expect(formatBytes(2048)).toBe('2 Ko');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3,0 Mo');
  });
});
