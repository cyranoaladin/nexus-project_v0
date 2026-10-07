import { validateBilanStep, normalizeBilanContent, assertBilanReadyToSubmit, computeBilanProgress } from '@/lib/espace/bilan-work';
import { getActivityDef, getLessonSteps } from '@/lib/espace/catalog';
import { lessonHref } from '@/lib/espace/lesson-routes';
import type { WorkContent } from '@/lib/espace/work-content';

describe('contrat des bilans', () => {
  it.each(['3e', '2nde'] as const)('enregistre le catalogue et la destination %s sans nouvelles tables', (level) => {
    const slug = `maths-bilan-septembre-2026-${level}`;
    expect(getActivityDef(slug)).toMatchObject({ kind: 'RESOURCE_PACK', stepsTotal: 8 });
    expect(getLessonSteps(slug).map(s => s.id)).toEqual(['scope', 'mastery', 'evidence', 'methods', 'experience', 'growth', 'next', 'review']);
    expect(lessonHref(slug, 'assigned-seat')).toBe(`/espace/bilan/${level}?seance=assigned-seat`);
  });

  it('refuse un champ élève qui se fait passer pour une appréciation enseignante', () => {
    expect(() => validateBilanStep('3e', 'methods', { fields: { teacher: 'Acquis validés' } })).toThrow();
  });
  it('refuse une note ou du code dans un bilan de ressenti', () => {
    expect(() => validateBilanStep('3e', 'methods', { code: 'print(1)' })).toThrow();
    expect(() => validateBilanStep('3e', 'methods', { choices: { frequency: 2 } })).toThrow();
  });
  it('refuse un choix radio inconnu et trop de choix multiples', () => {
    expect(() => validateBilanStep('3e', 'methods', { fields: { frequency: 'Faux choix' } })).toThrow();
    expect(() => validateBilanStep('3e', 'methods', { fields: { blockers: JSON.stringify(['Comprendre la consigne','Choisir une méthode','Faire les calculs']) } })).toThrow();
  });
  it('accepte une étape vide ou une réponse facultative sautée', () => {
    expect(() => validateBilanStep('3e', 'methods', { fields: {} })).not.toThrow();
    expect(() => validateBilanStep('3e', 'methods', { fields: { frequency: '' } })).not.toThrow();
  });
  it('accepte un refus explicite de répondre sans le mélanger à d’autres réponses', () => {
    expect(() => validateBilanStep('3e', 'methods', { fields: { frequency: 'Je ne souhaite pas répondre', practice: '["Je ne souhaite pas répondre"]' } })).not.toThrow();
    expect(() => validateBilanStep('3e', 'methods', { fields: { practice: '["Je ne souhaite pas répondre","Je relis le cours"]' } })).toThrow();
  });
  it('refuse des preuves JSON malformées ou contenant des champs inconnus', () => {
    expect(() => validateBilanStep('3e', 'evidence', { fields: { '3-div': '{bad' } })).toThrow();
    expect(() => validateBilanStep('3e', 'evidence', { fields: { '3-div': JSON.stringify({ answer: '1', corrected: true }) } })).toThrow();
  });
  it('limite à deux preuves sans rendre ces preuves obligatoires', () => {
    const evidence = JSON.stringify({ answer: '', aid: '', retry: '', skipped: false });
    expect(() => validateBilanStep('3e', 'evidence', { fields: { '3-div': evidence, '3-prime-task': evidence, '3-lots': evidence } })).toThrow();
    expect(() => validateBilanStep('3e', 'evidence', { fields: {} })).not.toThrow();
  });
  it('retire une preuve devenue hors périmètre sans empêcher la modification du parcours', () => {
    const content: WorkContent = { v: 1, steps: {
      scope: { fields: { '3-arith': 'yes' } },
      mastery: { fields: { '3-square': 'notworked' } },
      evidence: { fields: { '3-div': JSON.stringify({ answer: 'Essai', aid: '', retry: '', skipped: false }), '3-prime-task': JSON.stringify({ answer: 'À exclure', aid: '', retry: '', skipped: false }) } },
    } };
    const next = normalizeBilanContent('3e', content);
    expect(Object.keys(next.steps.evidence.fields!)).toEqual(['3-div']);
    expect(content.steps.evidence.fields).toHaveProperty('3-prime-task');
  });
  it('exige une confirmation finale mais aucune réponse de ressenti obligatoire', () => {
    expect(() => assertBilanReadyToSubmit('3e', { v: 1, steps: {} })).toThrow();
    expect(() => assertBilanReadyToSubmit('3e', { v: 1, steps: { review: { fields: { confirmed: 'yes' } } } })).not.toThrow();
  });
  it('compte les rubriques renseignées sans exiger les champs facultatifs ni mesurer une réussite', () => {
    const content: WorkContent = { v: 1, steps: {
      scope: { fields: { '3-arith': 'yes' } },
      mastery: { fields: { '3-div-s': 'start' } },
      methods: { fields: { frequency: 'Je ne souhaite pas répondre' } },
      evidence: { fields: {} },
    } };
    expect(computeBilanProgress('3e', content)).toEqual({ completedSteps: 3, requiredSteps: 8 });
  });
});
