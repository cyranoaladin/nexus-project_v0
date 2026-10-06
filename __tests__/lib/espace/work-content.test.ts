import { getPooContent, getPooRequiredSteps } from '@/lib/espace/catalog';
import {
  EMPTY_WORK_CONTENT,
  MAX_CODE_CHARS,
  WorkContentError,
  computeProgress,
  isStepComplete,
  mergeStep,
  parseStepPatch,
  parseWorkContent,
} from '@/lib/espace/work-content';

const steps = getPooContent().steps;
const reperes = steps[0];

function fullStep(stepDef: (typeof steps)[number]) {
  return {
    code: stepDef.starter ? `${stepDef.starter}\n# modifié` : undefined,
    fields: Object.fromEntries(stepDef.fields.map((f) => [f.id, 'ma réponse'])),
    choices: Object.fromEntries(stepDef.questions.map((q) => [q.id, q.correct])),
  };
}

describe('parseWorkContent', () => {
  it('un contenu vide ou absent devient le contenu vide canonique', () => {
    expect(parseWorkContent(undefined)).toEqual(EMPTY_WORK_CONTENT);
    expect(parseWorkContent({})).toEqual(EMPTY_WORK_CONTENT);
    expect(parseWorkContent(null)).toEqual(EMPTY_WORK_CONTENT);
  });

  it('accepte un contenu valide', () => {
    const c = parseWorkContent({ v: 1, steps: { reperes: { code: 'x = 1', fields: { a: 'b' }, choices: { q: 2 } } } });
    expect(c.steps.reperes.code).toBe('x = 1');
  });

  it('refuse un code trop long', () => {
    expect(() => parseWorkContent({ v: 1, steps: { reperes: { code: 'x'.repeat(MAX_CODE_CHARS + 1) } } })).toThrow(WorkContentError);
  });

  it('refuse les clés inattendues (pas de champ fourre-tout)', () => {
    expect(() => parseWorkContent({ v: 1, steps: { reperes: { evil: '<script>' } } })).toThrow(WorkContentError);
    expect(() => parseWorkContent({ v: 1, steps: {}, extra: 1 })).toThrow(WorkContentError);
  });

  it('refuse un indice de choix négatif ou non entier', () => {
    expect(() => parseWorkContent({ v: 1, steps: { reperes: { choices: { q: -1 } } } })).toThrow(WorkContentError);
    expect(() => parseWorkContent({ v: 1, steps: { reperes: { choices: { q: 1.5 } } } })).toThrow(WorkContentError);
  });
});

describe('parseStepPatch', () => {
  it("n'accepte qu'un identifiant d'étape du TP", () => {
    expect(() => parseStepPatch({ stepId: 'inconnue', step: {} }, steps.map((s) => s.id))).toThrow(WorkContentError);
    expect(parseStepPatch({ stepId: 'reperes', step: { code: 'a' } }, steps.map((s) => s.id)).stepId).toBe('reperes');
  });
});

describe('mergeStep', () => {
  it("remplace uniquement l'étape visée", () => {
    const base = parseWorkContent({ v: 1, steps: { reperes: { code: 'a' }, instances: { code: 'b' } } });
    const next = mergeStep(base, 'reperes', { code: 'a2' });
    expect(next.steps.reperes.code).toBe('a2');
    expect(next.steps.instances.code).toBe('b');
    expect(base.steps.reperes.code).toBe('a'); // immuable
  });
});

describe('progression', () => {
  it('0/7 sans travail', () => {
    expect(computeProgress(steps, EMPTY_WORK_CONTENT)).toEqual({ completedSteps: 0, requiredSteps: 7 });
  });

  it("une étape est complète quand questions, champs et code (si départ) sont renseignés", () => {
    const c = mergeStep(EMPTY_WORK_CONTENT, 'reperes', fullStep(reperes));
    expect(isStepComplete(reperes, c.steps.reperes)).toBe(true);
    expect(computeProgress(steps, c).completedSteps).toBe(1);
  });

  it('le code laissé tel que le départ ne compte pas comme travail', () => {
    const c = mergeStep(EMPTY_WORK_CONTENT, 'reperes', { ...fullStep(reperes), code: reperes.starter ?? undefined });
    expect(isStepComplete(reperes, c.steps.reperes)).toBe(false);
  });

  it('un champ vide ou fait d’espaces ne compte pas', () => {
    const f = fullStep(reperes);
    const first = reperes.fields[0].id;
    const c = mergeStep(EMPTY_WORK_CONTENT, 'reperes', { ...f, fields: { ...f.fields, [first]: '   ' } });
    expect(isStepComplete(reperes, c.steps.reperes)).toBe(false);
  });

  it('le bonus ne fait jamais partie du total requis', () => {
    let c = EMPTY_WORK_CONTENT;
    for (const s of steps) c = mergeStep(c, s.id, fullStep(s));
    expect(computeProgress(steps, c)).toEqual({ completedSteps: 7, requiredSteps: 7 });
    expect(getPooRequiredSteps().map((s) => s.id)).not.toContain('bonus');
  });

  it("répondre à une question avec un choix hors plage ne la valide pas", () => {
    const f = fullStep(reperes);
    const q = reperes.questions[0];
    const c = mergeStep(EMPTY_WORK_CONTENT, 'reperes', { ...f, choices: { ...f.choices, [q.id]: 99 } });
    expect(isStepComplete(reperes, c.steps.reperes)).toBe(false);
  });
});
