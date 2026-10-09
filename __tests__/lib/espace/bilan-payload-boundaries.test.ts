import { bilanData, getBilanLesson, type BilanLevel } from '@/lib/espace/bilan-data';
import { validateBilanStep, normalizeBilanContent, computeBilanProgress } from '@/lib/espace/bilan-work';
import { parseStepPatch, parseWorkContent } from '@/lib/espace/work-content';

describe.each(['3e', '2nde'] as BilanLevel[])('contrat payload %s', level => {
  const defs = getBilanLesson(level).steps;
  const module = bilanData.modules[level][0];
  const skill = module.skills[0];
  const task = bilanData.tasks.find(t => t.module === module.id)!;
  it('accepte tous les choix documentés et seulement les champs de ce niveau', () => {
    for (const value of ['yes', 'no', 'unsure', '']) expect(() => validateBilanStep(level, 'scope', { fields: { [module.id]: value } })).not.toThrow();
    for (const value of Object.keys(bilanData.mastery)) expect(() => validateBilanStep(level, 'mastery', { fields: { [skill.id]: value } })).not.toThrow();
    for (const section of bilanData.sections) for (const question of section.questions) {
      if (question.type === 'radio') for (const value of question.options ?? []) expect(() => validateBilanStep(level, section.id, { fields: { [question.id]: value } })).not.toThrow();
      if (question.type === 'multi') for (const value of question.options ?? []) expect(() => validateBilanStep(level, section.id, { fields: { [question.id]: JSON.stringify([value]) } })).not.toThrow();
    }
  });

  it('ne laisse passer aucune clé de l’autre niveau', () => {
    const opposite = bilanData.modules[level === '3e' ? '2nde' : '3e'];
    expect(() => validateBilanStep(level, 'scope', { fields: { [opposite[0].id]: 'yes' } })).toThrow();
    expect(() => validateBilanStep(level, 'mastery', { fields: { [opposite[0].skills[0].id]: 'alone' } })).toThrow();
  });

  it.each(['choices', 'code', 'tests', 'tries', 'solved', 'hints'])('refuse les métadonnées formatives %s inutiles au bilan', key => {
    expect(() => validateBilanStep(level, 'scope', { [key]: undefined } as never)).toThrow();
  });

  it.each(['null', '[]', '42', '"texte"', '{"answer":5}', '{"skipped":"true"}', '{"retry":{}}', '{"aid":null}', '{"unknown":"x"}'])('rejette la preuve JSON %s', raw => {
    expect(() => validateBilanStep(level, 'evidence', { fields: { [task.id]: raw } })).toThrow();
  });

  it('limite les textes libres et l’enveloppe JSON indépendamment', () => {
    expect(() => validateBilanStep(level, 'scope', { fields: { other: 'é'.repeat(5000) } })).not.toThrow();
    expect(() => validateBilanStep(level, 'scope', { fields: { other: 'x'.repeat(5001) } })).toThrow();
    expect(() => validateBilanStep(level, 'evidence', { fields: { [task.id]: JSON.stringify({ aid: 'x'.repeat(161) }) } })).toThrow();
    expect(() => parseStepPatch({ stepId: 'scope', step: { fields: { other: 12 } } }, defs.map(d => d.id))).toThrow();
  });

  it.each(['["Je relis le cours","Je relis le cours"]', '[1]', '{}', 'null', '["inconnu"]', 'false'])('rejette une multisélection mal formée %s', raw => {
    expect(() => validateBilanStep(level, 'methods', { fields: { practice: raw } })).toThrow();
  });

  it('préserve littéralement les caractères spéciaux sans les interpréter', () => {
    const value = '<script>jamais exécuté</script>\nMaths √2, é, \\ et "citations"';
    const content = parseWorkContent({ v: 1, steps: { scope: { fields: { other: value } } } });
    expect(normalizeBilanContent(level, content).steps.scope.fields?.other).toBe(value);
  });

  it('une absence de réponse donne zéro rubrique renseignée, aucun échec', () => {
    const content = { v: 1 as const, steps: Object.fromEntries(defs.map(d => [d.id, { fields: {} }])) };
    expect(computeBilanProgress(level, content)).toEqual({ completedSteps: 0, requiredSteps: 13 });
  });
});
