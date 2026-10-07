import { formatBilanAnswer, bilanViewerSteps } from '@/lib/espace/bilan-display';

it('renders the first attempt, help and retry as separate readable evidence', () => {
  const answer = formatBilanAnswer('evidence', JSON.stringify({ answer: '<script>essai</script>', aid: 'Un indice', retry: 'Nouvel essai', skipped: false }));
  expect(answer).toContain('Premier essai : <script>essai</script>');
  expect(answer).toContain('Aide déclarée : Un indice');
  expect(answer).toContain('Après aide ou reprise : Nouvel essai');
  expect(answer).not.toContain('{');
});
it('distinguishes an unattempted task from an incorrect task', () => {
  expect(formatBilanAnswer('evidence', '{"skipped":true}')).toContain('non fait');
  expect(formatBilanAnswer('scope', 'no')).toBe('Non travaillé');
  expect(formatBilanAnswer('mastery', 'notworked')).toContain('pas été travaillée');
});
it('keeps preferences unscored and maps multiple choices to readable text', () => {
  expect(formatBilanAnswer('multi', '["Relire","Refaire seul"]')).toBe('Relire ; Refaire seul');
  expect(bilanViewerSteps('3e').every(s => s.questions.length === 0)).toBe(true);
});
it('transmet les thèmes de tous les prérequis pour masquer un essai non applicable chez le professeur', () => {
  const field=bilanViewerSteps('tle-maths').find(s=>s.id==='evidence')?.fields.find(f=>f.id==='tm-auxiliary-task');
  expect(field).toMatchObject({requiredScopeModules:expect.arrayContaining(['tm-usual','tm-affine'])});
});
